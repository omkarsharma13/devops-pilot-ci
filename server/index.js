const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());

const DB_FILE = path.join(__dirname, 'db.json');

// Define our worker pool
const WORKERS = [
    { id: 'w1', name: 'Node.js Agent', capability: 'javascript', status: 'idle', currentJob: null },
    { id: 'w2', name: 'Python Agent', capability: 'python', status: 'idle', currentJob: null },
    { id: 'w3', name: 'Go Agent', capability: 'go', status: 'idle', currentJob: null },
    { id: 'w4', name: 'General Agent', capability: 'general', status: 'idle', currentJob: null },
];

async function getDB() {
    try {
        const data = await fs.readFile(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return { jobs: [], workers: WORKERS };
    }
}

async function saveDB(data) {
    // Sync memory workers to DB for UI reading
    data.workers = WORKERS.map(w => ({ ...w }));
    await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2));
}

function assignWorker(language) {
    const langLower = language ? language.toLowerCase() : 'general';
    // Find preferred worker
    let worker = WORKERS.find(w => w.status === 'idle' && w.capability === langLower);
    if (!worker) {
        // Fallback to general worker
        worker = WORKERS.find(w => w.status === 'idle' && w.capability === 'general');
    }
    return worker;
}

// 1. & 2. GitHub Webhook Simulation Endpoint
app.post('/api/webhook/github', async (req, res) => {
    // Mock parsing of a typical GitHub push payload
    const payload = req.body;
    let repoUrl = 'https://github.com/unknown/repo';
    let branch = 'main';
    let language = 'general';

    if (payload.repository) {
        repoUrl = payload.repository.html_url || payload.repository.url || repoUrl;
        language = payload.repository.language || 'general';
    }
    if (payload.ref) {
        // e.g. refs/heads/main -> main
        branch = payload.ref.replace('refs/heads/', '');
    }

    const job = await createJob(repoUrl, branch, language);
    res.status(202).json({ message: 'Webhook received, job queued.', job });
});

// Original manual jobs endpoint
app.post('/api/jobs', async (req, res) => {
    const { repoUrl, branch, language } = req.body;
    if (!repoUrl || !branch) {
        return res.status(400).json({ error: 'repoUrl and branch are required' });
    }
    const job = await createJob(repoUrl, branch, language || 'general');
    res.status(201).json(job);
});

function getBranchPriority(branch) {
    const normalized = (branch || '').toLowerCase();
    if (normalized === 'main' || normalized === 'master') return 1;
    if (normalized.startsWith('release') || normalized.startsWith('hotfix') || normalized.startsWith('prod')) return 2;
    if (normalized.startsWith('staging') || normalized.startsWith('qa') || normalized.startsWith('preprod')) return 3;
    if (normalized.startsWith('feature') || normalized.startsWith('bugfix') || normalized.startsWith('chore')) return 4;
    return 5;
}

function getRepoPriority(repoUrl) {
    const normalized = (repoUrl || '').toLowerCase();
    if (normalized.includes('/core') || normalized.includes('/platform') || normalized.includes('/backend')) return 1;
    if (normalized.includes('/service') || normalized.includes('/api') || normalized.includes('/engine')) return 2;
    if (normalized.includes('/shared') || normalized.includes('/common') || normalized.includes('/lib')) return 3;
    return 4;
}

function getPriorityLabel(priority) {
    if (priority <= 12) return 'High';
    if (priority <= 24) return 'Medium';
    return 'Low';
}

function getPriorityScore(repoUrl, branch) {
    return getBranchPriority(branch) * 10 + getRepoPriority(repoUrl);
}

async function createJob(repoUrl, branch, language) {
    const db = await getDB();
    const normalizedLanguage = (language || 'general').toLowerCase();
    const priority = getPriorityScore(repoUrl, branch);
    const newJob = {
        id: uuidv4().substring(0, 8),
        repoUrl,
        branch,
        language: normalizedLanguage,
        priority,
        priorityLabel: getPriorityLabel(priority),
        status: 'queued',
        result: null,
        workerAssigned: null,
        createdAt: new Date().toISOString(),
        startedAt: null,
        completedAt: null,
        stages: [
            { name: 'Checkout & Prepare', status: 'pending', duration: Math.floor(Math.random()*(4-2)+2) },
            { name: 'Build Image', status: 'pending', duration: Math.floor(Math.random()*(8-4)+4) },
            { name: 'Run Unit Tests', status: 'pending', duration: Math.floor(Math.random()*(6-3)+3) },
            { name: 'Deploy to Staging', status: 'pending', duration: Math.floor(Math.random()*(5-2)+2) }
        ],
        currentStageIndex: 0
    };
    db.jobs.push(newJob);
    await saveDB(db);
    return newJob;
}

// Data fetching
app.get('/api/jobs', async (req, res) => {
    const db = await getDB();
    res.json({ jobs: db.jobs, workers: db.workers });
});

app.post('/api/jobs/reset', async (req, res) => {
    WORKERS.forEach(w => {
        w.status = 'idle';
        w.currentJob = null;
    });
    await saveDB({ jobs: [], workers: WORKERS });
    res.json({ message: 'cleared' });
});

// 7. Simulate Random Traffic Load
app.post('/api/simulate-load', async (req, res) => {
    const pushes = [
        { repo: 'https://github.com/company/core-platform', branch: 'main', language: 'javascript' },
        { repo: 'https://github.com/company/core-platform', branch: 'release/v1.1', language: 'javascript' },
        { repo: 'https://github.com/company/order-service', branch: 'main', language: 'go' },
        { repo: 'https://github.com/company/order-service', branch: 'feature/cart-improvements', language: 'go' },
        { repo: 'https://github.com/company/user-service', branch: 'hotfix/user-login', language: 'python' },
        { repo: 'https://github.com/company/user-service', branch: 'feature/profile-update', language: 'python' }
    ];  

    for (const push of pushes) {
        await createJob(push.repo, push.branch, push.language);
    }

    res.json({ message: `Simulated ${pushes.length} Git pushes across 3 repos and 6 branches.` });
});

// 5. Pipeline Scheduler & Worker Assignment
async function processJobs() {
    const db = await getDB();
    let updated = false;

    // A. Pick up queued jobs if there's worker capacity
    const queuedJobs = db.jobs
        .filter(j => j.status === 'queued')
        .sort((a, b) => {
            if ((a.priority ?? 999) !== (b.priority ?? 999)) return (a.priority ?? 999) - (b.priority ?? 999);
            return new Date(a.createdAt) - new Date(b.createdAt);
        });
    
    for (let job of queuedJobs) {
        const worker = assignWorker(job.language);
        if (worker) {
            // Assign job to worker
            worker.status = 'busy';
            worker.currentJob = job.id;
            
            job.status = 'in-progress';
            job.startedAt = new Date().toISOString();
            job.workerAssigned = worker.name;
            if(job.stages.length > 0) {
              job.stages[0].status = 'running';
            }
            updated = true;
        }
    }

    // B. Advance in-progress jobs
    for (let job of db.jobs.filter(j => j.status === 'in-progress')) {
        const currentStage = job.stages[job.currentStageIndex];
        if (currentStage) {
            if (!currentStage.progressTicks) currentStage.progressTicks = 0;
            currentStage.progressTicks++;

            if (currentStage.progressTicks >= currentStage.duration) {
                currentStage.status = 'success';
                
                if (Math.random() < 0.15 && job.currentStageIndex >= 1) {
                    currentStage.status = 'failed';
                    finalizeJob(job, 'failed');
                    updated = true;
                    continue;
                }
                
                job.currentStageIndex++;
                if (job.currentStageIndex < job.stages.length) {
                    job.stages[job.currentStageIndex].status = 'running';
                } else {
                    finalizeJob(job, 'success');
                }
            }
            updated = true;
        }
    }

    if (updated) {
        await saveDB(db);
    }
}

function finalizeJob(job, resultMode) {
    job.status = 'completed';
    job.result = resultMode;
    job.completedAt = new Date().toISOString();
    
    // Free the worker
    const worker = WORKERS.find(w => w.currentJob === job.id);
    if (worker) {
        worker.status = 'idle';
        worker.currentJob = null;
    }
}

// Tick processing
setInterval(processJobs, 1000);

const PORT = 4000;
app.get('/', (req, res) => {
  res.send('Pilot CI Backend Running');
});
app.listen(PORT, () => {
    console.log(`Pipeline API server listening on http://localhost:${PORT}`);
});

app.get('/', (req, res) => {
  res.send('Pilot CI Backend Running');
});