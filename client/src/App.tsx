import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Play, Plus, Server, GitBranch, FolderGit2, Circle, CheckCircle2, XCircle, Clock, Loader2, Zap, HardDrive, Cpu, Activity } from 'lucide-react';

interface Stage {
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed';
}

interface WorkerAgent {
  id: string;
  name: string;
  capability: string;
  status: 'idle' | 'busy';
  currentJob: string | null;
}

interface Job {
  id: string;
  repoUrl: string;
  branch: string;
  language: string;
  status: 'queued' | 'in-progress' | 'completed';
  result: 'success' | 'failed' | null;
  workerAssigned: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  stages: Stage[];
}

function App() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [workers, setWorkers] = useState<WorkerAgent[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [repoUrl, setRepoUrl] = useState('https://github.com/company/auth-service');
  const [branch, setBranch] = useState('main');
  const [language, setLanguage] = useState('javascript');

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const res = await axios.get('/api/jobs');
        setJobs(res.data.jobs || []);
        setWorkers(res.data.workers || []);
      } catch (err) {
        console.error('Failed to fetch jobs', err);
      }
    };

    fetchJobs();
    const interval = setInterval(fetchJobs, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleQueueJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl || !branch) return;

    try {
      await axios.post('/api/jobs', { repoUrl, branch, language });
      setShowModal(false);
    } catch (err) {
      console.error(err);
    }
  };

  const simulateLoad = async () => {
    try {
      await axios.post('/api/simulate-load');
    } catch (err) {
      console.error(err);
    }
  };

  const queuedJobs = jobs.filter(j => j.status === 'queued');
  const inProgressJobs = jobs.filter(j => j.status === 'in-progress');
  const completedJobs = jobs.filter(j => j.status === 'completed');

  return (
    <>
      {/* Navbar */}
      <nav className="navbar">
        <div className="brand">
          <Server className="brand-icon" size={28} />
          Pilot CI
        </div>
        <div className="nav-actions">
          <button className="btn" onClick={simulateLoad} style={{ background: 'rgba(210,168,255,0.1)', borderColor: 'rgba(210,168,255,0.3)', color: '#d2a8ff' }}>
            <Zap size={16} /> Simulate Traffic Spike
          </button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={18} /> Manual Trigger
          </button>
        </div>
      </nav>

      {/* Workers Panel */}
      <div style={{ padding: '1.5rem 2rem 0', display: 'flex', gap: '1rem', overflowX: 'auto' }}>
        {workers.map(w => (
          <div key={w.id} className={`worker-card ${w.status === 'busy' ? 'busy' : ''}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="worker-icon"><Cpu size={20} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{w.name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Capability: {w.capability}</div>
              </div>
              {w.status === 'busy' ? <Activity size={18} color="var(--color-progress)" className="spin-slow" /> : <Clock size={16} color="var(--text-muted)" />}
            </div>
            <div className="worker-status-badge" style={{ marginTop: '8px' }}>
               Status: {w.status === 'busy' ? <span style={{ color: 'var(--color-progress)' }}>Executing #{w.currentJob}</span> : <span style={{ color: 'var(--text-muted)' }}>Idle</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Main Board */}
      <div className="dashboard-container">
        
        {/* Queued Column */}
        <div className="column queued">
          <div className="column-header">
            <Clock size={18} color="var(--color-queued)" /> <span style={{ flex: 1 }}>Queue Backup</span>
            <span className="badge">{queuedJobs.length}</span>
          </div>
          <div className="column-jobs">
             {queuedJobs.length === 0 && <span style={{color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', marginTop: '2rem'}}>Queue is empty</span>}
             {queuedJobs.map(job => <JobCard key={job.id} job={job} />)}
          </div>
        </div>

        {/* In Progress Column */}
        <div className="column progress">
          <div className="column-header">
            <Play size={18} color="var(--color-progress)" /> <span style={{ flex: 1 }}>Executing Workers</span>
            <span className="badge">{inProgressJobs.length}</span>
          </div>
          <div className="column-jobs">
            {inProgressJobs.length === 0 && <span style={{color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', marginTop: '2rem'}}>No active pipelines</span>}
            {inProgressJobs.map(job => <JobCard key={job.id} job={job} />)}
          </div>
        </div>

        {/* Completed Column */}
        <div className="column completed">
          <div className="column-header">
            <CheckCircle2 size={18} color="var(--color-success)" /> <span style={{ flex: 1 }}>Execution History</span>
            <span className="badge">{completedJobs.length}</span>
          </div>
          <div className="column-jobs">
            {completedJobs.length === 0 && <span style={{color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', marginTop: '2rem'}}>No finished pipelines</span>}
            {completedJobs.map(job => <JobCard key={job.id} job={job} />)}
          </div>
        </div>

      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: '1.5rem' }}>Schedule Pipeline</h2>
            <form onSubmit={handleQueueJob}>
              <div className="form-group">
                <label className="form-label">Repository URL</label>
                <div style={{ position: 'relative' }}>
                  <FolderGit2 style={{position: 'absolute', top: '10px', left: '12px', color: 'var(--text-muted)'}} size={18} />
                  <input 
                    type="url" 
                    className="form-input" 
                    style={{ paddingLeft: '40px' }}
                    value={repoUrl} 
                    onChange={e => setRepoUrl(e.target.value)} 
                    placeholder="https://github.com/..." 
                    required 
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Project Required Setup (Language Stack)</label>
                <div style={{ position: 'relative' }}>
                  <HardDrive style={{position: 'absolute', top: '10px', left: '12px', color: 'var(--text-muted)'}} size={18} />
                  <select 
                    className="form-input" 
                    style={{ paddingLeft: '40px' }}
                    value={language} 
                    onChange={e => setLanguage(e.target.value)} 
                    required
                  >
                    <option value="javascript">JavaScript / Node.js</option>
                    <option value="python">Python</option>
                    <option value="go">Golang</option>
                    <option value="java">Java</option>
                    <option value="general">Generic Framework</option>
                  </select>
                </div>
              </div>
              <div className="form-group" style={{marginTop: '1rem'}}>
                <label className="form-label">Branch name</label>
                <div style={{ position: 'relative' }}>
                  <GitBranch style={{position: 'absolute', top: '10px', left: '12px', color: 'var(--text-muted)'}} size={18} />
                  <input 
                    type="text" 
                    className="form-input" 
                    style={{ paddingLeft: '40px' }}
                    value={branch} 
                    onChange={e => setBranch(e.target.value)} 
                    required 
                  />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Queue Run</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function JobCard({ job }: { job: Job }) {
  const getCardClass = () => {
    if (job.status === 'queued') return 'job-card status-queued';
    if (job.status === 'in-progress') return 'job-card status-in-progress';
    return job.result === 'success' ? 'job-card status-success' : 'job-card status-failed';
  };

  const getRepoName = (url: string) => {
    try {
      const parsed = new URL(url);
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) return `${parts[parts.length-2]}/${parts[parts.length-1]}`;
      return url;
    } catch {
      return url;
    }
  };

  return (
    <div className={getCardClass()}>
      <div className="job-header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div className="job-title">
            <FolderGit2 size={16} color="var(--text-muted)" />
            <a href={job.repoUrl} target="_blank" rel="noreferrer" className="job-repo">{getRepoName(job.repoUrl)}</a>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="job-branch"><GitBranch size={12} /> {job.branch}</span>
            <span className="job-id">#{job.id}</span>
            <span className="lang-tag">{job.language}</span>
          </div>
          {job.workerAssigned && (
             <div style={{ fontSize: '0.75rem', color: 'var(--color-progress)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Cpu size={12} /> Assigned to: {job.workerAssigned}
             </div>
          )}
        </div>
      </div>

      {job.status !== 'queued' && job.stages && (
        <div className="pipeline">
          {job.stages.map((stage, i) => (
            <div key={i} className={`stage ${stage.status}`}>
              <div className="stage-icon-wrapper">
                {stage.status === 'pending' && <Circle size={14} className="stage-icon" />}
                {stage.status === 'running' && <Loader2 size={14} className="stage-icon" />}
                {stage.status === 'success' && <CheckCircle2 size={14} className="stage-icon" />}
                {stage.status === 'failed' && <XCircle size={14} className="stage-icon" />}
                <div className="stage-line" />
              </div>
              <span className="stage-name">{stage.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
