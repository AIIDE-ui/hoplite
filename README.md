# Semester 3 – Productive App

A personal, single-user, local-first web application for tracking **B.Ed. Semester III** practical records under **Tamil Nadu Teachers Education University (TNTEU)** (CBCS 2021–2022 pattern).

> **Important Notice**: This application is built for **personal local use only, no authentication, not for multi-user hosting**. Do not expose this server directly to the public internet.

---

## Features

- **SQLite Persistent Storage**: Uses Node's built-in `node:sqlite` (`DatabaseSync`) with WAL mode, foreign keys enforced, and versioned schema migrations (`PRAGMA user_version`).
- **Official TNTEU B.Ed. Semester III Structure**:
  - **Part A — Teaching Competency and Practical Records**: 16 seeded practical record tasks across Level I, Level II, and general Part A records. Official total: 20 credits / 400 marks (planning split across the 16 seeded records: 14 credits / 280 marks). Includes the required Teaching Competency demonstration note.
  - **Part B — EPC Records**: 4 seeded Enhancing Professional Capacities records (1 credit / 20 marks each; official total: 4 credits / 80 marks).
  - **Part C — Online Course (SWAYAM)**: Official 1 credit / 20 marks online course tracked via its own course status selector (`Not Started` / `In Progress` / `Completed`) without distorting practical record completion percentages, plus optional user-created tasks.
  - **Custom Category**: Add custom tasks or personal study items.
- **Full Record Management**: Search, multi-criteria filtering (synced with URL query parameters), sorting, inline status/difficulty updates, manual reordering, bulk status change and bulk archiving, subtasks checklist (with completion suggestion banner), task notes, focus/manual effort tracking, and complete audit history.
- **Restore Original Syllabus**: Safely re-creates missing seeded tasks and un-archives soft-deleted seeded tasks by `seed_key` without overwriting existing edits, custom tasks, subtasks, notes, or focus sessions.

---

## Installation & Running Locally

### Prerequisites
- **Node.js** v22.5.0+ (includes built-in `node:sqlite`)
- **npm** (or bun)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment (Optional)
Copy `.env.example` to `.env` if you wish to customize the bind address, port, or database directory:
```bash
cp .env.example .env
```
By default in code:
- `HOST` defaults to `127.0.0.1`
- `PORT` defaults to `3000`
- `DATA_DIR` defaults to `data`

### 3. Run in Development Mode
```bash
npm run dev
```
Opens the Express API + Vite middleware server at `http://127.0.0.1:3000` (or the configured `HOST:PORT`).

### 4. Production Build & Start
```bash
npm run build
npm start
```
`npm run build` typechecks the codebase and builds the frontend into `dist/`. `npm start` serves both the built client and `/api/*` from the single Express server port.

### 5. Typecheck & Tests
```bash
npm run typecheck
npm test
```

---

## Database Location, Backup & Reset

- **Database Path**: By default, the SQLite database file is created at:
  ```
  data/bed-tracker.sqlite
  ```
  (Along with `bed-tracker.sqlite-wal` and `bed-tracker.sqlite-shm` when active). You can override the directory using the `DATA_DIR` environment variable.
- **Safe Startup**: The database is never overwritten or recreated on server restart or hot reload. Schema updates use `PRAGMA user_version` migrations, and seeding runs once idempotently inside the initialization transaction.
- **Backing Up Your Data**:
  1. **In-App JSON Export**: Go to **Settings → Data & Backup → Export JSON** (or `GET /api/backup/json`) to download a full JSON snapshot of your profile, settings, categories, syllabus summary, tasks, subtasks, notes, focus sessions, and activity log.
  2. **File Copy**: Stop the server and copy `data/bed-tracker.sqlite` to your backup drive.
- **Resetting the Database**:
  To wipe and re-seed the database from the command line, run:
  ```bash
  npm run db:reset -- --yes
  ```
  *(Refuses to run without the `--yes` flag to prevent accidental data loss.)*
