# DevOps Pilot CI Simulator

This repository contains a simple CI/CD simulation with a priority-based job queue and a web dashboard.

## What was added

- Priority scheduling for queued jobs.
- Job priority is derived from:
  - branch name (`main`, `release/*`, `hotfix/*`, `feature/*`, etc.)
  - repository type (`core`, `platform`, `backend`, `service`, `api`, `shared`, etc.)
- The queue uses priority ordering first, then FIFO for tie-breaking.
- Load simulation now creates Git pushes for:
  - `core-platform` on `main` and `release/v1.1`
  - `order-service` on `main` and `feature/cart-improvements`
  - `user-service` on `hotfix/user-login` and `feature/profile-update`


## How to run

From the project root:

```bash
npm run install-all
npm run start
```

Then open the client app in the browser using the Vite URL shown in the terminal (usually `http://localhost:5173`).

The API server listens on `http://localhost:4000`.

## How to simulate multi-repo Git pushes

Open the browser dashboard and click `Simulate Traffic Spike`, or call:

```bash
curl -X POST http://localhost:4000/api/simulate-load
```

This will enqueue multiple jobs from at least 4 repositories and 8 branches.

## Notes for finals

- The repo contains real Git commits.
- The priority scheduling logic is in `server/index.js`.
- The UI shows `priority` for each queued job.
