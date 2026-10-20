import type { SqliteDatabase } from './connection.ts';
import { SEED_TASKS } from './seed-data.ts';

export const CURRENT_SCHEMA_VERSION = 4;

export function getSchemaVersion(db: SqliteDatabase): number {
  const row = db.get<{ user_version: number }>('PRAGMA user_version;');
  return row ? Number(row.user_version) : 0;
}

export function runMigrations(db: SqliteDatabase): void {
  const currentVersion = getSchemaVersion(db);
  if (currentVersion >= CURRENT_SCHEMA_VERSION) {
    return;
  }

  db.transaction(() => {
    if (currentVersion < 1) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS student_profile (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          name TEXT NOT NULL DEFAULT '',
          roll_number TEXT NOT NULL DEFAULT '',
          university TEXT NOT NULL DEFAULT 'TNTEU',
          programme TEXT NOT NULL DEFAULT 'B.Ed.',
          semester INTEGER NOT NULL DEFAULT 3,
          syllabus_pattern TEXT NOT NULL DEFAULT 'CBCS 2021–2022',
          academic_year TEXT NOT NULL DEFAULT '2025–2027',
          college TEXT NOT NULL DEFAULT '',
          teaching_subject TEXT NOT NULL DEFAULT '',
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          seed_key TEXT UNIQUE,
          name TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          note TEXT NOT NULL DEFAULT '',
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          seed_key TEXT UNIQUE,
          title TEXT NOT NULL,
          category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
          level TEXT NOT NULL DEFAULT 'N/A' CHECK (level IN ('Level I', 'Level II', 'N/A')),
          status TEXT NOT NULL DEFAULT 'Not Started' CHECK (status IN ('Not Started', 'In Progress', 'Completed')),
          difficulty TEXT NOT NULL DEFAULT 'Medium' CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
          priority TEXT NOT NULL DEFAULT 'Normal' CHECK (priority IN ('Low', 'Normal', 'High', 'Urgent')),
          start_date TEXT,
          due_date TEXT,
          notes TEXT NOT NULL DEFAULT '',
          estimated_minutes INTEGER NOT NULL DEFAULT 0 CHECK (estimated_minutes >= 0),
          credits REAL NOT NULL DEFAULT 0 CHECK (credits >= 0),
          marks REAL NOT NULL DEFAULT 0 CHECK (marks >= 0),
          manual_minutes_adjustment INTEGER NOT NULL DEFAULT 0,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          completed_at TEXT,
          archived_at TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
        CREATE INDEX IF NOT EXISTS idx_tasks_difficulty ON tasks(difficulty);
        CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
        CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
        CREATE INDEX IF NOT EXISTS idx_tasks_category_id ON tasks(category_id);
        CREATE INDEX IF NOT EXISTS idx_tasks_archived_at ON tasks(archived_at);
        CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON tasks(updated_at);

        CREATE TABLE IF NOT EXISTS subtasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          done INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1)),
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON subtasks(task_id);

        CREATE TABLE IF NOT EXISTS task_notes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
          title TEXT NOT NULL DEFAULT '',
          content TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_task_notes_task_id ON task_notes(task_id);

        CREATE TABLE IF NOT EXISTS focus_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
          task_title TEXT NOT NULL,
          duration_minutes INTEGER NOT NULL CHECK (duration_minutes >= 0),
          started_at TEXT NOT NULL,
          ended_at TEXT,
          notes TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_focus_sessions_task_id ON focus_sessions(task_id);

        CREATE TABLE IF NOT EXISTS task_activity (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entity_type TEXT NOT NULL CHECK (entity_type IN ('task', 'course', 'system')),
          task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
          task_title TEXT NOT NULL DEFAULT '',
          action TEXT NOT NULL,
          from_value TEXT,
          to_value TEXT,
          created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_task_activity_task_id ON task_activity(task_id);
        CREATE INDEX IF NOT EXISTS idx_task_activity_created_at ON task_activity(created_at DESC);

        CREATE TABLE IF NOT EXISTS app_settings (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          theme TEXT NOT NULL DEFAULT 'dark' CHECK (theme IN ('light', 'dark')),
          week_start TEXT NOT NULL DEFAULT 'Mon' CHECK (week_start IN ('Mon', 'Sun')),
          date_format TEXT NOT NULL DEFAULT 'DD/MM/YYYY' CHECK (date_format IN ('DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD')),
          time_format TEXT NOT NULL DEFAULT '12h' CHECK (time_format IN ('12h', '24h')),
          db_created_at TEXT NOT NULL,
          initial_seed_completed INTEGER NOT NULL DEFAULT 0,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS syllabus_summary (
          part TEXT PRIMARY KEY CHECK (part IN ('Part A', 'Part B', 'Part C')),
          title TEXT NOT NULL,
          official_credits REAL NOT NULL CHECK (official_credits >= 0),
          official_marks REAL NOT NULL CHECK (official_marks >= 0),
          note TEXT NOT NULL DEFAULT '',
          course_status TEXT CHECK (course_status IS NULL OR course_status IN ('Not Started', 'In Progress', 'Completed')),
          updated_at TEXT NOT NULL
        );
      `);
      db.exec('PRAGMA user_version = 1;');
    }

    if (currentVersion < 2) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE COLLATE NOCASE,
          display_name TEXT NOT NULL,
          roll_number TEXT NOT NULL DEFAULT '',
          password_hash TEXT NOT NULL,
          password_salt TEXT NOT NULL,
          db_filename TEXT NOT NULL UNIQUE,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS user_sessions (
          token TEXT PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TEXT NOT NULL,
          expires_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
      `);
      db.exec('PRAGMA user_version = 2;');
    }

    if (currentVersion < 3) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS admin_credentials (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          username TEXT NOT NULL UNIQUE COLLATE NOCASE,
          password_hash TEXT NOT NULL,
          password_salt TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS admin_sessions (
          token TEXT PRIMARY KEY,
          created_at TEXT NOT NULL,
          expires_at TEXT NOT NULL
        );

        UPDATE app_settings SET theme = 'dark' WHERE id = 1;

        DELETE FROM categories
        WHERE seed_key = 'custom'
          AND NOT EXISTS (SELECT 1 FROM tasks WHERE tasks.category_id = categories.id);
      `);
      db.exec('PRAGMA user_version = 3;');
    }

    if (currentVersion < 4) {
      for (const seedTask of SEED_TASKS) {
        db.run(
          `UPDATE tasks
           SET level = ?, credits = ?, marks = ?, difficulty = ?
           WHERE seed_key = ?`,
          seedTask.level,
          seedTask.credits,
          seedTask.marks,
          seedTask.difficulty,
          seedTask.seed_key
        );
      }
      db.exec('PRAGMA user_version = 4;');
    }
  });
}

