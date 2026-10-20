import type { RestoreSyllabusPreview } from '../../src/shared/constants.ts';
import type { SqliteDatabase } from './connection.ts';
import { SEED_CATEGORIES, SEED_SYLLABUS_SUMMARY, SEED_TASKS } from './seed-data.ts';

export function ensureInitialSeed(db: SqliteDatabase): void {
  db.transaction(() => {
    const now = new Date().toISOString();

    // 1. Ensure app_settings row exists
    const settingsRow = db.get<{ id: number; initial_seed_completed: number }>(
      'SELECT id, initial_seed_completed FROM app_settings WHERE id = 1'
    );

    if (!settingsRow) {
      db.run(
        `INSERT INTO app_settings (id, theme, week_start, date_format, time_format, db_created_at, initial_seed_completed, updated_at)
         VALUES (1, 'dark', 'Mon', 'DD/MM/YYYY', '12h', ?, 0, ?)`,
        now,
        now
      );
    }

    // 2. Ensure student_profile row exists
    const profileRow = db.get<{ id: number }>('SELECT id FROM student_profile WHERE id = 1');
    if (!profileRow) {
      db.run(
        `INSERT INTO student_profile (id, name, roll_number, university, programme, semester, syllabus_pattern, academic_year, college, teaching_subject, updated_at)
         VALUES (1, '', '', 'TNTEU', 'B.Ed.', 3, 'CBCS 2021–2022', '2025–2027', '', '', ?)`,
        now
      );
    }

    // 3. Ensure syllabus_summary rows exist (never overwrite existing rows)
    for (const item of SEED_SYLLABUS_SUMMARY) {
      const existing = db.get<{ part: string }>(
        'SELECT part FROM syllabus_summary WHERE part = ?',
        item.part
      );
      if (!existing) {
        db.run(
          `INSERT INTO syllabus_summary (part, title, official_credits, official_marks, note, course_status, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          item.part,
          item.title,
          item.official_credits,
          item.official_marks,
          item.note,
          item.course_status,
          now
        );
      }
    }

    // 4. Run initial task/category seeding only once if initial_seed_completed === 0
    const currentSettings = db.get<{ initial_seed_completed: number }>(
      'SELECT initial_seed_completed FROM app_settings WHERE id = 1'
    );
    if (currentSettings && currentSettings.initial_seed_completed === 1) {
      return;
    }

    // Insert categories idempotently by seed_key
    for (const cat of SEED_CATEGORIES) {
      const existingCat = db.get<{ id: number }>(
        'SELECT id FROM categories WHERE seed_key = ?',
        cat.seed_key
      );
      if (!existingCat) {
        db.run(
          `INSERT INTO categories (seed_key, name, description, note, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          cat.seed_key,
          cat.name,
          cat.description,
          cat.note,
          cat.sort_order,
          now,
          now
        );
      }
    }

    // Map category seed_key -> id
    const categoryRows = db.all<{ id: number; seed_key: string }>(
      'SELECT id, seed_key FROM categories WHERE seed_key IS NOT NULL'
    );
    const catMap = new Map<string, number>();
    for (const c of categoryRows) {
      catMap.set(c.seed_key, c.id);
    }

    // Insert the 20 tasks idempotently by seed_key
    for (const task of SEED_TASKS) {
      const existingTask = db.get<{ id: number }>(
        'SELECT id FROM tasks WHERE seed_key = ?',
        task.seed_key
      );
      if (!existingTask) {
        const categoryId = catMap.get(task.category_seed_key);
        if (!categoryId) {
          throw new Error(`Missing seeded category for ${task.category_seed_key}`);
        }
        db.run(
          `INSERT INTO tasks (
            seed_key, title, category_id, level, status, difficulty, priority,
            start_date, due_date, notes, estimated_minutes, credits, marks,
            manual_minutes_adjustment, sort_order, created_at, updated_at,
            completed_at, archived_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, '', 0, ?, ?, 0, ?, ?, ?, NULL, NULL)`,
          task.seed_key,
          task.title,
          categoryId,
          task.level,
          task.status,
          task.difficulty,
          task.priority,
          task.credits,
          task.marks,
          task.sort_order,
          now,
          now
        );
      }
    }

    // Mark initial seed completed
    db.run(
      'UPDATE app_settings SET initial_seed_completed = 1, updated_at = ? WHERE id = 1',
      now
    );

    // Log system initialization activity if none exists
    const activityCount = db.get<{ cnt: number }>('SELECT COUNT(*) as cnt FROM task_activity');
    if (!activityCount || activityCount.cnt === 0) {
      db.run(
        `INSERT INTO task_activity (entity_type, task_id, task_title, action, from_value, to_value, created_at)
         VALUES ('system', NULL, 'TNTEU B.Ed. Semester III Syllabus', 'initialized', NULL, '20 practical records seeded', ?)`,
        now
      );
    }
  });
}

export function previewRestoreSyllabus(db: SqliteDatabase): RestoreSyllabusPreview {
  const existingCategories = db.all<{ id: number; seed_key: string }>(
    'SELECT id, seed_key FROM categories WHERE seed_key IS NOT NULL'
  );
  const existingCatKeys = new Set(existingCategories.map((c) => c.seed_key));

  const missing_categories = SEED_CATEGORIES.filter((c) => !existingCatKeys.has(c.seed_key)).map(
    (c) => ({ seed_key: c.seed_key, name: c.name })
  );

  const existingSeededTasks = db.all<{
    id: number;
    seed_key: string;
    title: string;
    archived_at: string | null;
  }>('SELECT id, seed_key, title, archived_at FROM tasks WHERE seed_key IS NOT NULL');

  const taskBySeedKey = new Map(existingSeededTasks.map((t) => [t.seed_key, t]));

  const missing_tasks: Array<{ seed_key: string; title: string; part: string }> = [];
  const archived_tasks: Array<{ id: number; seed_key: string; title: string; part: string }> = [];

  for (const seedTask of SEED_TASKS) {
    const partLabel = seedTask.category_seed_key === 'part_a' ? 'Part A' : 'Part B';
    const found = taskBySeedKey.get(seedTask.seed_key);
    if (!found) {
      missing_tasks.push({
        seed_key: seedTask.seed_key,
        title: seedTask.title,
        part: partLabel,
      });
    } else if (found.archived_at !== null) {
      archived_tasks.push({
        id: found.id,
        seed_key: seedTask.seed_key,
        title: found.title,
        part: partLabel,
      });
    }
  }

  return {
    missing_tasks,
    archived_tasks,
    missing_categories,
    total_to_restore:
      missing_tasks.length + archived_tasks.length + missing_categories.length,
  };
}

export function executeRestoreSyllabus(db: SqliteDatabase): {
  restored_missing_tasks: number;
  unarchived_tasks: number;
  restored_categories: number;
  preview: RestoreSyllabusPreview;
} {
  return db.transaction(() => {
    const now = new Date().toISOString();
    const preview = previewRestoreSyllabus(db);

    let restored_categories = 0;
    for (const cat of SEED_CATEGORIES) {
      const existing = db.get<{ id: number }>(
        'SELECT id FROM categories WHERE seed_key = ?',
        cat.seed_key
      );
      if (!existing) {
        db.run(
          `INSERT INTO categories (seed_key, name, description, note, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          cat.seed_key,
          cat.name,
          cat.description,
          cat.note,
          cat.sort_order,
          now,
          now
        );
        restored_categories++;
      }
    }

    const categoryRows = db.all<{ id: number; seed_key: string }>(
      'SELECT id, seed_key FROM categories WHERE seed_key IS NOT NULL'
    );
    const catMap = new Map<string, number>();
    for (const c of categoryRows) {
      catMap.set(c.seed_key, c.id);
    }

    let restored_missing_tasks = 0;
    let unarchived_tasks = 0;

    for (const seedTask of SEED_TASKS) {
      const existing = db.get<{ id: number; title: string; archived_at: string | null }>(
        'SELECT id, title, archived_at FROM tasks WHERE seed_key = ?',
        seedTask.seed_key
      );

      if (!existing) {
        const categoryId = catMap.get(seedTask.category_seed_key);
        if (!categoryId) {
          throw new Error(`Category ${seedTask.category_seed_key} not found during restore.`);
        }
        const res = db.run(
          `INSERT INTO tasks (
            seed_key, title, category_id, level, status, difficulty, priority,
            start_date, due_date, notes, estimated_minutes, credits, marks,
            manual_minutes_adjustment, sort_order, created_at, updated_at,
            completed_at, archived_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, '', 0, ?, ?, 0, ?, ?, ?, NULL, NULL)`,
          seedTask.seed_key,
          seedTask.title,
          categoryId,
          seedTask.level,
          seedTask.status,
          seedTask.difficulty,
          seedTask.priority,
          seedTask.credits,
          seedTask.marks,
          seedTask.sort_order,
          now,
          now
        );
        restored_missing_tasks++;
        db.run(
          `INSERT INTO task_activity (entity_type, task_id, task_title, action, from_value, to_value, created_at)
           VALUES ('task', ?, ?, 'restored_from_syllabus', 'deleted', 'Not Started', ?)`,
          res.lastInsertRowid,
          seedTask.title,
          now
        );
      } else if (existing.archived_at !== null) {
        db.run(
          'UPDATE tasks SET archived_at = NULL, updated_at = ? WHERE id = ?',
          now,
          existing.id
        );
        unarchived_tasks++;
        db.run(
          `INSERT INTO task_activity (entity_type, task_id, task_title, action, from_value, to_value, created_at)
           VALUES ('task', ?, ?, 'restored', 'archived', 'active', ?)`,
          existing.id,
          existing.title,
          now
        );
      }
    }

    if (restored_missing_tasks > 0 || unarchived_tasks > 0 || restored_categories > 0) {
      db.run(
        `INSERT INTO task_activity (entity_type, task_id, task_title, action, from_value, to_value, created_at)
         VALUES ('system', NULL, 'Original Syllabus Restore', 'syllabus_restored', NULL, ?, ?)`,
        `Re-created ${restored_missing_tasks} missing, un-archived ${unarchived_tasks} archived`,
        now
      );
    }

    return {
      restored_missing_tasks,
      unarchived_tasks,
      restored_categories,
      preview,
    };
  });
}
