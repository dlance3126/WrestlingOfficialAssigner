# Wrestling Official Assigner

A local web app for wrestling assignors to manage teams, officials, events, and automatic official assignments by area.

The app has two parts:

- `backend/`: FastAPI API, SQLite by default, SQLAlchemy models, cookie-based login, area-scoped data.
- `frontend/`: React/Vite web interface for teams, officials, events, assignments, and Excel schedule export.

## Requirements

- Python 3.9 or newer
- Node.js 18 or newer
- npm

## First-Time Setup

Clone the repo and use the default branch:

```bash
git clone https://github.com/dlance3126/WrestlingOfficialAssigner.git
cd WrestlingOfficialAssigner
git switch main
```

Set up the backend:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Open `backend/.env` and replace `SECRET_KEY` with a random value:

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

Start the backend:

```bash
python3 -m uvicorn app:app --reload
```

The API runs at `http://127.0.0.1:8000`.

In a second terminal, set up and start the frontend:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173/`.

## Daily Use

Start the backend:

```bash
cd backend
source .venv/bin/activate
python3 -m uvicorn app:app --reload
```

Start the frontend in another terminal:

```bash
cd frontend
npm run dev
```

Then open `http://localhost:5173/`.

## Accounts And Areas

Create an account from the login screen:

1. Enter an email and password.
2. Select the correct area.
3. Click `Register admin`.
4. Log in with the same email and password.

Supported areas are:

- Area 1
- Area 2
- Area 3
- Area 4
- Area 5
- Area 6/8
- Area 7
- Area 9
- Area 10

Teams, officials, events, and assignment runs are scoped by area. Users in the same area share the same dataset. Users in different areas cannot see or edit each other's data.

## What The App Does

The dashboard has four tabs:

- `Assigner`: quick-add teams, officials, and events, run assignments, and view the live schedule.
- `Officials`: add, edit, and delete officials. Officials have a tier and optional unavailable dates.
- `Teams`: add, edit, and delete teams. Teams have a tier from 1 to 4.
- `Events`: add, edit, and delete scheduled events.

Event types:

- `Dual`: requires 2 teams.
- `Tri`: requires 3 teams.
- `Quad`: requires 4 teams.
- `Tournament`: requires a manual tier override and does not require teams.

The schedule panel can export `wrestling_schedule.xlsx`.

## Assignment Rules

Assignments are based on event tier, official tier, official availability, and time conflicts.

Event tiers:

- Tournaments use the selected tier override.
- Duals use the average tier of the two teams.
- Tris and quads use the average of the two highest team tiers.

Officials are skipped when:

- They have the event date listed as unavailable.
- They are already assigned to another event with an overlapping time window.

## Environment Variables

Backend settings live in `backend/.env`. Use `backend/.env.example` as the template.

- `SECRET_KEY`: required for signed login cookies. Generate this once and keep it private.
- `JWT_EXPIRE_MINUTES`: login session duration. Default: `120`.
- `FRONTEND_ORIGIN`: allowed browser origins for CORS. Default: `http://localhost:5173`.
- `DATABASE_URL`: database connection URL. Default: `sqlite:///./wrestling.db`.
- `ENV`: set to `prod` for secure cookies in production.

Frontend settings can be placed in `frontend/.env`:

```bash
VITE_API=http://localhost:8000
```

If `VITE_API` is not set, the frontend uses `http://localhost:8000`.

## Repository Hygiene

These local files are intentionally not tracked:

- `backend/.env`
- `backend/wrestling.db`
- `backend/.venv/`
- `frontend/node_modules/`
- `frontend/dist/`
- local editor, OS, cache, and log files

Do not commit real secrets or local database files.

## Validation

Backend import check:

```bash
cd backend
source .venv/bin/activate
python3 -c "import app; print('backend import ok')"
```

Frontend production build:

```bash
cd frontend
npm run build
```

## Troubleshooting

- If the browser cannot load data, confirm both servers are running.
- If login succeeds but data requests fail, confirm `FRONTEND_ORIGIN` matches the frontend URL.
- If schema changes cause local errors, stop the backend, delete `backend/wrestling.db`, and restart the backend. This resets local data.
- If another device needs to access the frontend, add that device's frontend URL to `FRONTEND_ORIGIN` as a comma-separated value and restart the backend.
