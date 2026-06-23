Wrestling Official Assignment App
================================

Overview
--------
This toolkit helps athletic directors or assignors schedule wrestling events and
automatically match officials based on event difficulty, availability, and tier
policies. You interact with a web interface that now includes a tabbed dashboard
for **Assigner, Officials, Teams, and Events**; the code pieces described below
only run locally on your computer unless you decide to deploy them.

Folder Layout (FYI only)
------------------------
- `backend/` — the secure API that stores information and performs assignments.
- `frontend/` — the website you will open in your browser. It lists teams, officials,
  and scheduled events and lets you export the calendar to Excel.

What You Need Installed Once
----------------------------
1. **Python 3.9 or newer** (macOS already has Python 3, but you may install the
   latest from https://www.python.org if needed).
2. **Node.js 18 or newer** (download from https://nodejs.org and install – this
   also gives you the `npm` command we will use).

Quick Start (Step‑by‑Step)
-------------------------
Follow these instructions exactly; the quoted text is what you type into the
Terminal application. Perform steps 1–5 once; afterwards you only need the “Daily
Use” section.

### 1. Prepare the backend
```
cd path/to/wrestling-assigner/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Create your settings file
```
cp .env.example .env
```
Open the new `.env` file in a text editor and replace `SECRET_KEY` with a random
64-character hex string. You can generate one by running:
```
python3 -c "import secrets; print(secrets.token_hex(32))"
```
Copy the printed value into the `.env` file and save.

### 3. Start the backend server
```
python3 -m uvicorn app:app --reload
```
Leave this Terminal window open; it shows helpful logs. The API now listens at
`http://127.0.0.1:8000`.

### 4. Prepare the frontend (first time)
Open a second Terminal window:
```
cd path/to/wrestling-assigner/frontend
npm install
```

### 5. Start the website
In that same window run:
```
npm run dev
```
Your browser address is `http://localhost:5173/`. Keep this window running while
you use the application.

Daily Use
---------
1. Open the backend Terminal window and run `python3 -m uvicorn app:app --reload`.
2. Open the frontend Terminal window and run `npm run dev`.
3. In a web browser go to `http://localhost:5173/`.

Creating Your Account
---------------------
- The login page shows default values (`admin@example.com`, `changeme`).
- Select your **Area** (Area 1, Area 2, Area 3, Area 4, Area 5, Area 6/8, Area 7, Area 9, Area 10).
- Click **Register admin** once to create yourself; then press **Login**.
- Every account only sees the teams, officials, and events for its own area, so two
  coordinators in different areas never mix data.
- Your session is stored in a secure cookie, so the browser will stay logged in
  until you press **Logout** or close the servers.

Using the App
-------------
The dashboard header shows four tabs; they all work on the same data, so changes in
one place appear everywhere:

1. **Officials tab** — add new officials, or click **Edit** to adjust name/tier and
   unavailable dates inline. Use **Delete** to remove an official.
2. **Teams tab** — manage school names and tiers the same way.
3. **Events tab** — view every scheduled event with its type, times, participating
   teams, and currently assigned officials. Click **Edit** for a full event editor
   (choose participants, tier override, start/end, and the “Official(s) Required”
   field). Use **Delete** to remove an event.
4. **Assigner tab** — combines the quick-add forms (Teams, Officials, Schedule Event)
   with the live schedule panel on the right. The schedule export button downloads
   `wrestling_schedule.xlsx` at any time.

Whenever you schedule an event from the Assigner tab:
- Select an **Event type** (Tournament/Dual/Tri/Quad). Tournament events require a
  tier override; the others auto-calc from their teams.
- Choose start/end times and set the **Official(s) Required** value to the number of
  officials needed.
- Click **Schedule event**; the event appears instantly and can be edited later from
  the Events tab.
- Press **Run assignments** to have the backend fill official slots according to the
  tier policy; results display inline and in the schedule panel.

Areas & Data Sharing
--------------------
- Each user belongs to a single Area (Area 1, Area 2, Area 3, Area 4, Area 5,
  Area 6/8, Area 7, Area 9, Area 10). Pick the correct one when registering.
- All data—teams, officials, events, assignment runs—is automatically scoped to the
  current user’s Area. Users in the same Area collaborate on the same dataset; users
  in other Areas cannot see or modify it.

Tips & Troubleshooting
----------------------
- If the browser says “Load Failed” ensure you are visiting exactly
  `http://localhost:5173/` and that both Terminal windows are running.
- If you recently pulled schema changes and see “Load Failed” right after logging in,
  delete `backend/wrestling.db` and restart the backend so the new tables are created.
- To allow another computer on your network to open the site, add its URL to the
  `FRONTEND_ORIGIN` entry in `backend/.env` (comma-separated list). Restart the
  backend afterwards.
- Deleting `backend/wrestling.db` resets the database (for example, if you want a
  clean slate). Do this only when both servers are stopped.
- To stop the servers press `Ctrl+C` in each Terminal window.

Advanced Notes (Optional)
-------------------------
- Environment variables available in `backend/.env`:
  * `SECRET_KEY` — required; generated once.
  * `JWT_EXPIRE_MINUTES` — length of login sessions (default 120 minutes).
  * `FRONTEND_ORIGIN` — allowed website origins, comma-separated.
  * `DATABASE_URL` — change to use Postgres or another database.
  * `ENV` — set to `prod` if you host the backend publicly (enforces secure cookies).
- When you are comfortable, you can turn the development servers into production
  deployments by running `npm run build` for the frontend and using a production
  ASGI server such as `uvicorn --workers 4` for the backend.

Repository Notes
----------------
- The root `.gitignore` excludes the Python virtual environment, Node dependencies,
  build artifacts, local `.env` files, and the SQLite database so secrets and generated
  files never reach Git.
