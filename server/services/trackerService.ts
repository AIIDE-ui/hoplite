import type {
  AppSettings,
  Category,
  CategoryStatusChartRow,
  CourseStatus,
  DashboardSummary,
  FocusSession,
  StudentProfile,
  Subtask,
  SyllabusOverviewResponse,
  SyllabusPart,
  SyllabusSummaryItem,
  Task,
  TaskActivity,
  TaskDetail,
  TaskDifficulty,
  TaskLevel,
  TaskNote,
  TaskPriority,
  TaskStatus,
} from '../../src/shared/constants.ts';
import { TEACHING_COMPETENCY_NOTE } from '../../src/shared/constants.ts';
import {
  computeTaskStatistics,
  formatPartAPlanningNote,
  getLocalTodayYMD,
  shouldSuggestTaskCompletion,
} from '../../src/shared/stats.ts';
import type { SqliteDatabase } from '../db/connection.ts';
import { AppError } from '../errors.ts';

interface RawTaskRow {
  id: number;
  seed_key: string | null;
  title: string;
  category_id: number;
  category_name: string;
  category_seed_key: string | null;
  level: TaskLevel;
  status: TaskStatus;
  difficulty: TaskDifficulty;
  priority: TaskPriority;
  start_date: string | null;
  due_date: string | null;
  notes: string;
  estimated_minutes: number;
  credits: number;
  marks: number;
  manual_minutes_adjustment: number;
  focus_minutes_sum: number;
  subtask_total: number;
  subtask_done: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  archived_at: string | null;
}

function mapRawTask(row: RawTaskRow): Task {
  const focusSum = Number(row.focus_minutes_sum) || 0;
  const manualAdj = Number(row.manual_minutes_adjustment) || 0;
  return {
    id: Number(row.id),
    seed_key: row.seed_key ?? null,
    title: row.title,
    category_id: Number(row.category_id),
    category_name: row.category_name,
    category_seed_key: row.category_seed_key ?? null,
    level: row.level,
    status: row.status,
    difficulty: row.difficulty,
    priority: row.priority,
    start_date: row.start_date ?? null,
    due_date: row.due_date ?? null,
    notes: row.notes ?? '',
    estimated_minutes: Number(row.estimated_minutes) || 0,
    credits: Number(row.credits) || 0,
    marks: Number(row.marks) || 0,
    manual_minutes_adjustment: manualAdj,
    focus_minutes_sum: focusSum,
    time_spent_minutes: Math.max(0, focusSum + manualAdj),
    subtask_total: Number(row.subtask_total) || 0,
    subtask_done: Number(row.subtask_done) || 0,
    sort_order: Number(row.sort_order) || 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
    completed_at: row.completed_at ?? null,
    archived_at: row.archived_at ?? null,
  };
}

const TASK_SELECT_SQL = `
  SELECT
    t.*,
    c.name AS category_name,
    c.seed_key AS category_seed_key,
    COALESCE((SELECT SUM(fs.duration_minutes) FROM focus_sessions fs WHERE fs.task_id = t.id), 0) AS focus_minutes_sum,
    COALESCE((SELECT COUNT(*) FROM subtasks st WHERE st.task_id = t.id), 0) AS subtask_total,
    COALESCE((SELECT COUNT(*) FROM subtasks st WHERE st.task_id = t.id AND st.done = 1), 0) AS subtask_done
  FROM tasks t
  JOIN categories c ON c.id = t.category_id
`;

export function logActivity(
  db: SqliteDatabase,
  params: {
    entity_type: 'task' | 'course' | 'system';
    task_id: number | null;
    task_title: string;
    action: string;
    from_value?: string | null;
    to_value?: string | null;
    created_at?: string;
  }
): void {
  const now = params.created_at ?? new Date().toISOString();
  db.run(
    `INSERT INTO task_activity (entity_type, task_id, task_title, action, from_value, to_value, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    params.entity_type,
    params.task_id,
    params.task_title,
    params.action,
    params.from_value ?? null,
    params.to_value ?? null,
    now
  );
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export function getProfile(db: SqliteDatabase): StudentProfile {
  const row = db.get<StudentProfile>('SELECT * FROM student_profile WHERE id = 1');
  if (!row) {
    throw new AppError(404, 'NOT_FOUND', 'Student profile not found.');
  }
  return {
    ...row,
    id: Number(row.id),
    semester: Number(row.semester),
  };
}

export function updateProfile(
  db: SqliteDatabase,
  input: Omit<StudentProfile, 'id' | 'updated_at'>
): StudentProfile {
  const now = new Date().toISOString();
  db.run(
    `UPDATE student_profile
     SET name = ?, roll_number = ?, university = ?, programme = ?, semester = ?,
         syllabus_pattern = ?, academic_year = ?, college = ?, teaching_subject = ?,
         updated_at = ?
     WHERE id = 1`,
    input.name.trim(),
    input.roll_number.trim(),
    input.university.trim(),
    input.programme.trim(),
    input.semester,
    input.syllabus_pattern.trim(),
    input.academic_year.trim(),
    input.college.trim(),
    input.teaching_subject.trim(),
    now
  );
  return getProfile(db);
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export function getSettings(db: SqliteDatabase): AppSettings {
  const row = db.get<{
    id: number;
    theme: AppSettings['theme'];
    week_start: AppSettings['week_start'];
    date_format: AppSettings['date_format'];
    time_format: AppSettings['time_format'];
    db_created_at: string;
    updated_at: string;
  }>('SELECT id, theme, week_start, date_format, time_format, db_created_at, updated_at FROM app_settings WHERE id = 1');

  if (!row) {
    throw new AppError(404, 'NOT_FOUND', 'App settings not found.');
  }

  return {
    id: Number(row.id),
    theme: row.theme,
    week_start: row.week_start,
    date_format: row.date_format,
    time_format: row.time_format,
    db_created_at: row.db_created_at,
    db_path: db.dbPath,
    updated_at: row.updated_at,
  };
}

export function updateSettings(
  db: SqliteDatabase,
  input: Partial<Pick<AppSettings, 'theme' | 'week_start' | 'date_format' | 'time_format'>>
): AppSettings {
  const current = getSettings(db);
  const now = new Date().toISOString();

  db.run(
    `UPDATE app_settings
     SET theme = ?, week_start = ?, date_format = ?, time_format = ?, updated_at = ?
     WHERE id = 1`,
    input.theme ?? current.theme,
    input.week_start ?? current.week_start,
    input.date_format ?? current.date_format,
    input.time_format ?? current.time_format,
    now
  );

  return getSettings(db);
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export function listCategories(db: SqliteDatabase): Category[] {
  const rows = db.all<Category>(
    `SELECT
       c.*,
       COALESCE((SELECT COUNT(*) FROM tasks t WHERE t.category_id = c.id AND t.archived_at IS NULL), 0) AS task_count,
       COALESCE((SELECT COUNT(*) FROM tasks t WHERE t.category_id = c.id AND t.archived_at IS NULL AND t.status = 'Completed'), 0) AS completed_count
     FROM categories c
     ORDER BY c.sort_order ASC, c.id ASC`
  );
  return rows.map((r) => ({
    ...r,
    id: Number(r.id),
    sort_order: Number(r.sort_order),
    task_count: Number(r.task_count) || 0,
    completed_count: Number(r.completed_count) || 0,
  }));
}

export function getCategoryById(db: SqliteDatabase, id: number): Category {
  const row = db.get<Category>(
    `SELECT
       c.*,
       COALESCE((SELECT COUNT(*) FROM tasks t WHERE t.category_id = c.id AND t.archived_at IS NULL), 0) AS task_count,
       COALESCE((SELECT COUNT(*) FROM tasks t WHERE t.category_id = c.id AND t.archived_at IS NULL AND t.status = 'Completed'), 0) AS completed_count
     FROM categories c
     WHERE c.id = ?`,
    id
  );
  if (!row) {
    throw new AppError(404, 'NOT_FOUND', `Category with id ${id} not found.`);
  }
  return {
    ...row,
    id: Number(row.id),
    sort_order: Number(row.sort_order),
    task_count: Number(row.task_count) || 0,
    completed_count: Number(row.completed_count) || 0,
  };
}

export function createCategory(
  db: SqliteDatabase,
  input: { name: string; description?: string; note?: string }
): Category {
  const now = new Date().toISOString();
  const maxOrderRow = db.get<{ max_order: number | null }>(
    'SELECT MAX(sort_order) AS max_order FROM categories'
  );
  const nextOrder = (Number(maxOrderRow?.max_order) || 0) + 1;

  const res = db.run(
    `INSERT INTO categories (seed_key, name, description, note, sort_order, created_at, updated_at)
     VALUES (NULL, ?, ?, ?, ?, ?, ?)`,
    input.name.trim(),
    (input.description ?? '').trim(),
    (input.note ?? '').trim(),
    nextOrder,
    now,
    now
  );

  return getCategoryById(db, res.lastInsertRowid);
}

export function updateCategory(
  db: SqliteDatabase,
  id: number,
  input: { name?: string; description?: string; note?: string; sort_order?: number }
): Category {
  return db.transaction(() => {
    const existing = getCategoryById(db, id);
    const now = new Date().toISOString();

    const nextName = input.name !== undefined ? input.name.trim() : existing.name;
    const nextDesc =
      input.description !== undefined ? input.description.trim() : existing.description;
    const nextNote = input.note !== undefined ? input.note.trim() : existing.note;
    const nextOrder = input.sort_order !== undefined ? input.sort_order : existing.sort_order;

    db.run(
      `UPDATE categories
       SET name = ?, description = ?, note = ?, sort_order = ?, updated_at = ?
       WHERE id = ?`,
      nextName,
      nextDesc,
      nextNote,
      nextOrder,
      now,
      id
    );

    // If this is a seeded syllabus part category, sync title/note to syllabus_summary
    const partMap: Record<string, SyllabusPart> = {
      part_a: 'Part A',
      part_b: 'Part B',
      part_c: 'Part C',
    };
    if (existing.seed_key && partMap[existing.seed_key]) {
      const part = partMap[existing.seed_key];
      db.run(
        `UPDATE syllabus_summary
         SET title = ?, note = ?, updated_at = ?
         WHERE part = ?`,
        nextName,
        nextNote,
        now,
        part
      );
    }

    return getCategoryById(db, id);
  });
}

export function deleteCategory(db: SqliteDatabase, id: number): { deleted: boolean; id: number } {
  return db.transaction(() => {
    const existing = getCategoryById(db, id);

    if (existing.seed_key !== null) {
      throw new AppError(
        409,
        'SEEDED_CATEGORY_PROTECTED',
        'Seeded categories can be renamed, but cannot be deleted.'
      );
    }

    const activeCountRow = db.get<{ cnt: number }>(
      'SELECT COUNT(*) AS cnt FROM tasks WHERE category_id = ? AND archived_at IS NULL',
      id
    );
    if ((Number(activeCountRow?.cnt) || 0) > 0) {
      throw new AppError(
        409,
        'CATEGORY_HAS_TASKS',
        'Cannot delete a category that contains non-archived tasks.'
      );
    }

    // Reassign any archived tasks in this category to the first seeded official category
    const fallbackCat = db.get<{ id: number }>(
      'SELECT id FROM categories WHERE seed_key IS NOT NULL AND id != ? ORDER BY sort_order ASC LIMIT 1',
      id
    );
    if (fallbackCat) {
      db.run(
        'UPDATE tasks SET category_id = ? WHERE category_id = ? AND archived_at IS NOT NULL',
        fallbackCat.id,
        id
      );
    }

    db.run('DELETE FROM categories WHERE id = ?', id);
    return { deleted: true, id };
  });
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export interface TaskQueryFilters {
  search?: string;
  category?: string;
  status?: string;
  difficulty?: string;
  priority?: string;
  due?: string; // 'overdue' | 'today' | 'week' | 'none' | 'range'
  dueFrom?: string;
  dueTo?: string;
  sort?: string; // 'title' | 'status' | 'difficulty' | 'due' | 'updated' | 'manual'
  order?: string; // 'asc' | 'desc'
  page?: number;
  pageSize?: number;
  archived?: boolean;
  today?: string;
}

function addDaysYMD(ymd: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) return ymd;
  const d = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  d.setUTCDate(d.getUTCDate() + days);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function listTasks(
  db: SqliteDatabase,
  filters: TaskQueryFilters
): {
  items: Task[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
} {
  const whereClauses: string[] = [];
  const params: unknown[] = [];

  const isArchived = Boolean(filters.archived);
  if (isArchived) {
    whereClauses.push('t.archived_at IS NOT NULL');
  } else {
    whereClauses.push('t.archived_at IS NULL');
  }

  if (filters.search && filters.search.trim() !== '') {
    const q = `%${filters.search.trim().toLowerCase()}%`;
    whereClauses.push('(LOWER(t.title) LIKE ? OR LOWER(t.notes) LIKE ?)');
    params.push(q, q);
  }

  if (filters.category && filters.category.trim() !== '' && filters.category !== 'all') {
    const catVal = filters.category.trim();
    if (/^\d+$/.test(catVal)) {
      whereClauses.push('t.category_id = ?');
      params.push(Number(catVal));
    } else {
      const normalized = catVal.toLowerCase().replace(/\s+/g, '_');
      if (['part_a', 'part_b', 'part_c', 'custom'].includes(normalized)) {
        whereClauses.push('c.seed_key = ?');
        params.push(normalized);
      } else {
        whereClauses.push('(c.seed_key = ? OR LOWER(c.name) LIKE ?)');
        params.push(catVal, `%${catVal.toLowerCase()}%`);
      }
    }
  }

  if (filters.status && filters.status.trim() !== '' && filters.status !== 'all') {
    whereClauses.push('t.status = ?');
    params.push(filters.status.trim());
  }

  if (filters.difficulty && filters.difficulty.trim() !== '' && filters.difficulty !== 'all') {
    whereClauses.push('t.difficulty = ?');
    params.push(filters.difficulty.trim());
  }

  if (filters.priority && filters.priority.trim() !== '' && filters.priority !== 'all') {
    whereClauses.push('t.priority = ?');
    params.push(filters.priority.trim());
  }

  const today =
    filters.today && /^\d{4}-\d{2}-\d{2}$/.test(filters.today)
      ? filters.today
      : getLocalTodayYMD();

  if (filters.due && filters.due !== 'all') {
    const dueMode = filters.due.trim();
    if (dueMode === 'overdue') {
      whereClauses.push("t.due_date IS NOT NULL AND t.due_date < ? AND t.status != 'Completed'");
      params.push(today);
    } else if (dueMode === 'today') {
      whereClauses.push('t.due_date = ?');
      params.push(today);
    } else if (dueMode === 'week') {
      const weekEnd = addDaysYMD(today, 7);
      whereClauses.push('t.due_date IS NOT NULL AND t.due_date >= ? AND t.due_date <= ?');
      params.push(today, weekEnd);
    } else if (dueMode === 'none') {
      whereClauses.push('t.due_date IS NULL');
    } else if (dueMode === 'range') {
      if (filters.dueFrom && /^\d{4}-\d{2}-\d{2}$/.test(filters.dueFrom)) {
        whereClauses.push('t.due_date IS NOT NULL AND t.due_date >= ?');
        params.push(filters.dueFrom);
      }
      if (filters.dueTo && /^\d{4}-\d{2}-\d{2}$/.test(filters.dueTo)) {
        whereClauses.push('t.due_date IS NOT NULL AND t.due_date <= ?');
        params.push(filters.dueTo);
      }
    }
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const sortField = filters.sort || (isArchived ? 'updated' : 'manual');
  const sortDir = filters.order?.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

  let orderBySql = `t.sort_order ${sortDir}, t.id ASC`;
  if (sortField === 'title') {
    orderBySql = `t.title COLLATE NOCASE ${sortDir}, t.id ASC`;
  } else if (sortField === 'status') {
    orderBySql = `CASE t.status WHEN 'Not Started' THEN 1 WHEN 'In Progress' THEN 2 WHEN 'Completed' THEN 3 ELSE 4 END ${sortDir}, t.sort_order ASC`;
  } else if (sortField === 'difficulty') {
    orderBySql = `CASE t.difficulty WHEN 'Easy' THEN 1 WHEN 'Medium' THEN 2 WHEN 'Hard' THEN 3 ELSE 4 END ${sortDir}, t.sort_order ASC`;
  } else if (sortField === 'due' || sortField === 'due_date') {
    orderBySql = `CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END ASC, t.due_date ${sortDir}, t.sort_order ASC`;
  } else if (sortField === 'updated' || sortField === 'recently_updated' || sortField === 'updated_at') {
    const dir = filters.order ? sortDir : 'DESC';
    orderBySql = `t.updated_at ${dir}, t.id DESC`;
  } else if (sortField === 'manual' || sortField === 'sort_order') {
    orderBySql = `t.sort_order ${sortDir}, t.id ASC`;
  }

  const countRow = db.get<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM tasks t JOIN categories c ON c.id = t.category_id ${whereSql}`,
    ...params
  );
  const total = Number(countRow?.cnt) || 0;

  const pageSize = Math.min(200, Math.max(1, Number(filters.pageSize) || 20));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.max(1, Number(filters.page) || 1);
  const offset = (page - 1) * pageSize;

  const rows = db.all<RawTaskRow>(
    `${TASK_SELECT_SQL} ${whereSql} ORDER BY ${orderBySql} LIMIT ? OFFSET ?`,
    ...params,
    pageSize,
    offset
  );

  return {
    items: rows.map(mapRawTask),
    total,
    page,
    pageSize,
    totalPages,
  };
}

export function getTaskById(db: SqliteDatabase, id: number): Task {
  const row = db.get<RawTaskRow>(`${TASK_SELECT_SQL} WHERE t.id = ?`, id);
  if (!row) {
    throw new AppError(404, 'NOT_FOUND', `Record with id ${id} not found.`);
  }
  return mapRawTask(row);
}

export function getTaskDetailById(db: SqliteDatabase, id: number): TaskDetail {
  const task = getTaskById(db, id);
  const subtasks = listSubtasksForTask(db, id);
  const task_notes = listNotes(db, { taskId: String(id) });
  const focus_sessions = listFocusSessionsForTask(db, id);
  const activity = db.all<TaskActivity>(
    `SELECT * FROM task_activity WHERE task_id = ? ORDER BY created_at DESC, id DESC LIMIT 100`,
    id
  );

  return {
    ...task,
    subtasks,
    task_notes,
    focus_sessions,
    activity: activity.map((a) => ({
      ...a,
      id: Number(a.id),
      task_id: a.task_id !== null ? Number(a.task_id) : null,
    })),
  };
}

export function createTask(
  db: SqliteDatabase,
  input: {
    title: string;
    category_id: number;
    level?: TaskLevel;
    status?: TaskStatus;
    difficulty?: TaskDifficulty;
    priority?: TaskPriority;
    start_date?: string | null;
    due_date?: string | null;
    notes?: string;
    estimated_minutes?: number;
    credits?: number;
    marks?: number;
    manual_minutes_adjustment?: number;
  }
): Task {
  return db.transaction(() => {
    // Verify category exists
    getCategoryById(db, input.category_id);

    const now = new Date().toISOString();
    const maxSortRow = db.get<{ max_order: number | null }>(
      'SELECT MAX(sort_order) AS max_order FROM tasks'
    );
    const nextSortOrder = (Number(maxSortRow?.max_order) || 0) + 1;

    const status: TaskStatus = input.status ?? 'Not Started';
    const completedAt = status === 'Completed' ? now : null;

    const res = db.run(
      `INSERT INTO tasks (
        seed_key, title, category_id, level, status, difficulty, priority,
        start_date, due_date, notes, estimated_minutes, credits, marks,
        manual_minutes_adjustment, sort_order, created_at, updated_at,
        completed_at, archived_at
      ) VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      input.title.trim(),
      input.category_id,
      input.level ?? 'N/A',
      status,
      input.difficulty ?? 'Medium',
      input.priority ?? 'Normal',
      input.start_date ?? null,
      input.due_date ?? null,
      input.notes ?? '',
      input.estimated_minutes ?? 0,
      input.credits ?? 0,
      input.marks ?? 0,
      input.manual_minutes_adjustment ?? 0,
      nextSortOrder,
      now,
      now,
      completedAt
    );

    const created = getTaskById(db, res.lastInsertRowid);
    logActivity(db, {
      entity_type: 'task',
      task_id: created.id,
      task_title: created.title,
      action: 'created',
      from_value: null,
      to_value: created.status,
      created_at: now,
    });

    return created;
  });
}

export function updateTask(
  db: SqliteDatabase,
  id: number,
  input: Partial<{
    title: string;
    category_id: number;
    level: TaskLevel;
    status: TaskStatus;
    difficulty: TaskDifficulty;
    priority: TaskPriority;
    start_date: string | null;
    due_date: string | null;
    notes: string;
    estimated_minutes: number;
    credits: number;
    marks: number;
    manual_minutes_adjustment: number;
  }>
): Task {
  return db.transaction(() => {
    const existing = getTaskById(db, id);
    if (input.category_id !== undefined) {
      getCategoryById(db, input.category_id);
    }

    const nextStartDate =
      input.start_date !== undefined ? input.start_date : existing.start_date;
    const nextDueDate = input.due_date !== undefined ? input.due_date : existing.due_date;

    if (nextStartDate && nextDueDate && nextStartDate > nextDueDate) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Due date must be on or after the start date.', {
        due_date: 'Due date must be on or after the start date.',
      });
    }

    const now = new Date().toISOString();
    const nextTitle = input.title !== undefined ? input.title.trim() : existing.title;
    const nextCategoryId =
      input.category_id !== undefined ? input.category_id : existing.category_id;
    const nextLevel = input.level !== undefined ? input.level : existing.level;
    const nextStatus = input.status !== undefined ? input.status : existing.status;
    const nextDifficulty =
      input.difficulty !== undefined ? input.difficulty : existing.difficulty;
    const nextPriority = input.priority !== undefined ? input.priority : existing.priority;
    const nextNotes = input.notes !== undefined ? input.notes : existing.notes;
    const nextEstimated =
      input.estimated_minutes !== undefined
        ? input.estimated_minutes
        : existing.estimated_minutes;
    const nextCredits = input.credits !== undefined ? input.credits : existing.credits;
    const nextMarks = input.marks !== undefined ? input.marks : existing.marks;
    const nextManualAdj =
      input.manual_minutes_adjustment !== undefined
        ? input.manual_minutes_adjustment
        : existing.manual_minutes_adjustment;

    let nextCompletedAt = existing.completed_at;
    if (nextStatus === 'Completed' && existing.status !== 'Completed') {
      nextCompletedAt = now;
    } else if (nextStatus !== 'Completed') {
      nextCompletedAt = null;
    }

    db.run(
      `UPDATE tasks
       SET title = ?, category_id = ?, level = ?, status = ?, difficulty = ?,
           priority = ?, start_date = ?, due_date = ?, notes = ?,
           estimated_minutes = ?, credits = ?, marks = ?,
           manual_minutes_adjustment = ?, updated_at = ?, completed_at = ?
       WHERE id = ?`,
      nextTitle,
      nextCategoryId,
      nextLevel,
      nextStatus,
      nextDifficulty,
      nextPriority,
      nextStartDate,
      nextDueDate,
      nextNotes,
      nextEstimated,
      nextCredits,
      nextMarks,
      nextManualAdj,
      now,
      nextCompletedAt,
      id
    );

    if (nextStatus !== existing.status) {
      logActivity(db, {
        entity_type: 'task',
        task_id: id,
        task_title: nextTitle,
        action: 'status_changed',
        from_value: existing.status,
        to_value: nextStatus,
        created_at: now,
      });
    }

    const changedFields: string[] = [];
    if (nextTitle !== existing.title) changedFields.push('title');
    if (nextCategoryId !== existing.category_id) changedFields.push('category');
    if (nextLevel !== existing.level) changedFields.push('level');
    if (nextDifficulty !== existing.difficulty) changedFields.push('difficulty');
    if (nextPriority !== existing.priority) changedFields.push('priority');
    if (nextStartDate !== existing.start_date) changedFields.push('start_date');
    if (nextDueDate !== existing.due_date) changedFields.push('due_date');
    if (nextNotes !== existing.notes) changedFields.push('notes');
    if (nextEstimated !== existing.estimated_minutes) changedFields.push('estimated_minutes');
    if (nextCredits !== existing.credits) changedFields.push('credits');
    if (nextMarks !== existing.marks) changedFields.push('marks');
    if (nextManualAdj !== existing.manual_minutes_adjustment) {
      changedFields.push('manual_minutes_adjustment');
    }

    if (changedFields.length > 0) {
      logActivity(db, {
        entity_type: 'task',
        task_id: id,
        task_title: nextTitle,
        action: 'updated',
        from_value: null,
        to_value: changedFields.join(', '),
        created_at: now,
      });
    }

    return getTaskById(db, id);
  });
}

export function softDeleteTask(db: SqliteDatabase, id: number): Task {
  return db.transaction(() => {
    const existing = getTaskById(db, id);
    const now = new Date().toISOString();

    db.run('UPDATE tasks SET archived_at = ?, updated_at = ? WHERE id = ?', now, now, id);
    logActivity(db, {
      entity_type: 'task',
      task_id: id,
      task_title: existing.title,
      action: 'archived',
      from_value: 'active',
      to_value: 'archived',
      created_at: now,
    });

    return getTaskById(db, id);
  });
}

export function restoreTask(db: SqliteDatabase, id: number): Task {
  return db.transaction(() => {
    const existing = getTaskById(db, id);
    const now = new Date().toISOString();

    db.run('UPDATE tasks SET archived_at = NULL, updated_at = ? WHERE id = ?', now, id);
    logActivity(db, {
      entity_type: 'task',
      task_id: id,
      task_title: existing.title,
      action: 'restored',
      from_value: 'archived',
      to_value: 'active',
      created_at: now,
    });

    return getTaskById(db, id);
  });
}

export function permanentDeleteTask(
  db: SqliteDatabase,
  id: number
): { deleted: boolean; id: number; title: string } {
  return db.transaction(() => {
    const existing = getTaskById(db, id);
    const now = new Date().toISOString();

    // Ensure snapshot titles are preserved on focus_sessions and task_activity before deleting
    db.run('UPDATE focus_sessions SET task_title = ? WHERE task_id = ?', existing.title, id);
    db.run('UPDATE task_activity SET task_title = ? WHERE task_id = ?', existing.title, id);

    // Deleting from tasks cascades to subtasks and task_notes, and sets task_id = NULL on focus_sessions and task_activity
    db.run('DELETE FROM tasks WHERE id = ?', id);

    logActivity(db, {
      entity_type: 'task',
      task_id: null,
      task_title: existing.title,
      action: 'deleted_permanently',
      from_value: 'archived',
      to_value: 'deleted',
      created_at: now,
    });

    return { deleted: true, id, title: existing.title };
  });
}

export function reorderTasks(
  db: SqliteDatabase,
  input: { taskIds?: number[]; taskId?: number; direction?: 'up' | 'down' }
): { updated: number } {
  return db.transaction(() => {
    const now = new Date().toISOString();

    if (input.taskIds && input.taskIds.length > 0) {
      let count = 0;
      input.taskIds.forEach((id, idx) => {
        const res = db.run(
          'UPDATE tasks SET sort_order = ?, updated_at = ? WHERE id = ?',
          idx + 1,
          now,
          id
        );
        count += res.changes;
      });
      return { updated: count };
    }

    if (input.taskId && input.direction) {
      const allActive = db.all<{ id: number; sort_order: number }>(
        'SELECT id, sort_order FROM tasks WHERE archived_at IS NULL ORDER BY sort_order ASC, id ASC'
      );
      const idx = allActive.findIndex((t) => Number(t.id) === Number(input.taskId));
      if (idx === -1) {
        throw new AppError(404, 'NOT_FOUND', `Record ${input.taskId} not found.`);
      }
      const swapIdx = input.direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= allActive.length) {
        return { updated: 0 };
      }

      // Normalize sort_order across all active tasks after swapping
      const reordered = [...allActive];
      const temp = reordered[idx];
      reordered[idx] = reordered[swapIdx];
      reordered[swapIdx] = temp;

      reordered.forEach((item, i) => {
        db.run('UPDATE tasks SET sort_order = ? WHERE id = ?', i + 1, item.id);
      });
      db.run('UPDATE tasks SET updated_at = ? WHERE id = ?', now, input.taskId);
      return { updated: 2 };
    }

    return { updated: 0 };
  });
}

export function bulkUpdateTasks(
  db: SqliteDatabase,
  input: { taskIds: number[]; action: 'status' | 'archive' | 'restore'; status?: TaskStatus }
): { updatedCount: number; tasks: Task[] } {
  return db.transaction(() => {
    if (input.action === 'status' && !input.status) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Status is required for bulk status update.', {
        status: 'Status is required.',
      });
    }

    const updatedTasks: Task[] = [];
    for (const id of input.taskIds) {
      if (input.action === 'status' && input.status) {
        updatedTasks.push(updateTask(db, id, { status: input.status }));
      } else if (input.action === 'archive') {
        updatedTasks.push(softDeleteTask(db, id));
      } else if (input.action === 'restore') {
        updatedTasks.push(restoreTask(db, id));
      }
    }

    return {
      updatedCount: updatedTasks.length,
      tasks: updatedTasks,
    };
  });
}

// ---------------------------------------------------------------------------
// Subtasks
// ---------------------------------------------------------------------------

export function listSubtasksForTask(db: SqliteDatabase, taskId: number): Subtask[] {
  getTaskById(db, taskId);
  const rows = db.all<{
    id: number;
    task_id: number;
    title: string;
    done: number;
    sort_order: number;
    created_at: string;
    updated_at: string;
  }>('SELECT * FROM subtasks WHERE task_id = ? ORDER BY sort_order ASC, id ASC', taskId);

  return rows.map((r) => ({
    id: Number(r.id),
    task_id: Number(r.task_id),
    title: r.title,
    done: Boolean(r.done),
    sort_order: Number(r.sort_order),
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}

export function createSubtask(
  db: SqliteDatabase,
  taskId: number,
  input: { title: string; done?: boolean }
): { subtask: Subtask; subtasks: Subtask[]; suggest_complete: boolean } {
  return db.transaction(() => {
    const task = getTaskById(db, taskId);
    const now = new Date().toISOString();

    const maxRow = db.get<{ max_order: number | null }>(
      'SELECT MAX(sort_order) AS max_order FROM subtasks WHERE task_id = ?',
      taskId
    );
    const nextOrder = (Number(maxRow?.max_order) || 0) + 1;

    const res = db.run(
      `INSERT INTO subtasks (task_id, title, done, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      taskId,
      input.title.trim(),
      input.done ? 1 : 0,
      nextOrder,
      now,
      now
    );

    db.run('UPDATE tasks SET updated_at = ? WHERE id = ?', now, taskId);

    const subtasks = listSubtasksForTask(db, taskId);
    const created = subtasks.find((s) => s.id === res.lastInsertRowid)!;

    return {
      subtask: created,
      subtasks,
      suggest_complete: shouldSuggestTaskCompletion(task.status, subtasks),
    };
  });
}

export function updateSubtask(
  db: SqliteDatabase,
  subtaskId: number,
  input: { title?: string; done?: boolean; sort_order?: number }
): { subtask: Subtask; subtasks: Subtask[]; suggest_complete: boolean } {
  return db.transaction(() => {
    const existing = db.get<{
      id: number;
      task_id: number;
      title: string;
      done: number;
      sort_order: number;
    }>('SELECT * FROM subtasks WHERE id = ?', subtaskId);

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', `Subtask ${subtaskId} not found.`);
    }

    const now = new Date().toISOString();
    const nextTitle = input.title !== undefined ? input.title.trim() : existing.title;
    const nextDone = input.done !== undefined ? (input.done ? 1 : 0) : existing.done;
    const nextOrder = input.sort_order !== undefined ? input.sort_order : existing.sort_order;

    db.run(
      `UPDATE subtasks SET title = ?, done = ?, sort_order = ?, updated_at = ? WHERE id = ?`,
      nextTitle,
      nextDone,
      nextOrder,
      now,
      subtaskId
    );

    db.run('UPDATE tasks SET updated_at = ? WHERE id = ?', now, existing.task_id);

    const task = getTaskById(db, existing.task_id);
    const subtasks = listSubtasksForTask(db, existing.task_id);
    const updated = subtasks.find((s) => s.id === Number(subtaskId))!;

    return {
      subtask: updated,
      subtasks,
      suggest_complete: shouldSuggestTaskCompletion(task.status, subtasks),
    };
  });
}

export function deleteSubtask(
  db: SqliteDatabase,
  subtaskId: number
): { deleted: boolean; task_id: number; subtasks: Subtask[]; suggest_complete: boolean } {
  return db.transaction(() => {
    const existing = db.get<{ id: number; task_id: number }>(
      'SELECT id, task_id FROM subtasks WHERE id = ?',
      subtaskId
    );
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', `Subtask ${subtaskId} not found.`);
    }

    const now = new Date().toISOString();
    db.run('DELETE FROM subtasks WHERE id = ?', subtaskId);
    db.run('UPDATE tasks SET updated_at = ? WHERE id = ?', now, existing.task_id);

    const task = getTaskById(db, existing.task_id);
    const subtasks = listSubtasksForTask(db, existing.task_id);

    return {
      deleted: true,
      task_id: Number(existing.task_id),
      subtasks,
      suggest_complete: shouldSuggestTaskCompletion(task.status, subtasks),
    };
  });
}

// ---------------------------------------------------------------------------
// Notes (task_notes)
// ---------------------------------------------------------------------------

export function listNotes(
  db: SqliteDatabase,
  query: { taskId?: string; search?: string } = {}
): TaskNote[] {
  const where: string[] = [];
  const params: unknown[] = [];

  if (query.taskId !== undefined && query.taskId !== '' && query.taskId !== 'all') {
    if (query.taskId === 'general' || query.taskId === 'null') {
      where.push('n.task_id IS NULL');
    } else if (/^\d+$/.test(query.taskId)) {
      where.push('n.task_id = ?');
      params.push(Number(query.taskId));
    }
  }

  if (query.search && query.search.trim() !== '') {
    const q = `%${query.search.trim().toLowerCase()}%`;
    where.push(
      '(LOWER(n.title) LIKE ? OR LOWER(n.content) LIKE ? OR LOWER(COALESCE(t.title, \'\')) LIKE ?)'
    );
    params.push(q, q, q);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db.all<TaskNote>(
    `SELECT n.*, t.title AS task_title
     FROM task_notes n
     LEFT JOIN tasks t ON t.id = n.task_id
     ${whereSql}
     ORDER BY n.updated_at DESC, n.id DESC`,
    ...params
  );

  return rows.map((r) => ({
    id: Number(r.id),
    task_id: r.task_id !== null ? Number(r.task_id) : null,
    task_title: r.task_title ?? null,
    title: r.title ?? '',
    content: r.content,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}

export function createNote(
  db: SqliteDatabase,
  input: { task_id: number | null; title?: string; content: string }
): TaskNote {
  return db.transaction(() => {
    let taskTitle: string | null = null;
    if (input.task_id !== null) {
      const task = getTaskById(db, input.task_id);
      taskTitle = task.title;
    }

    const now = new Date().toISOString();
    const res = db.run(
      `INSERT INTO task_notes (task_id, title, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      input.task_id,
      (input.title ?? '').trim(),
      input.content.trim(),
      now,
      now
    );

    if (input.task_id !== null && taskTitle) {
      db.run('UPDATE tasks SET updated_at = ? WHERE id = ?', now, input.task_id);
      logActivity(db, {
        entity_type: 'task',
        task_id: input.task_id,
        task_title: taskTitle,
        action: 'note_added',
        from_value: null,
        to_value: (input.title || input.content).slice(0, 60),
        created_at: now,
      });
    }

    const row = db.get<TaskNote>(
      `SELECT n.*, t.title AS task_title
       FROM task_notes n
       LEFT JOIN tasks t ON t.id = n.task_id
       WHERE n.id = ?`,
      res.lastInsertRowid
    )!;

    return {
      id: Number(row.id),
      task_id: row.task_id !== null ? Number(row.task_id) : null,
      task_title: row.task_title ?? null,
      title: row.title ?? '',
      content: row.content,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  });
}

export function updateNote(
  db: SqliteDatabase,
  id: number,
  input: { task_id?: number | null; title?: string; content?: string }
): TaskNote {
  return db.transaction(() => {
    const existing = db.get<TaskNote>('SELECT * FROM task_notes WHERE id = ?', id);
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', `Note with id ${id} not found.`);
    }

    const nextTaskId =
      input.task_id !== undefined
        ? input.task_id
        : existing.task_id !== null
          ? Number(existing.task_id)
          : null;
    if (nextTaskId !== null) {
      getTaskById(db, nextTaskId);
    }

    const now = new Date().toISOString();
    const nextTitle = input.title !== undefined ? input.title.trim() : existing.title;
    const nextContent = input.content !== undefined ? input.content.trim() : existing.content;

    db.run(
      `UPDATE task_notes SET task_id = ?, title = ?, content = ?, updated_at = ? WHERE id = ?`,
      nextTaskId,
      nextTitle,
      nextContent,
      now,
      id
    );

    const row = db.get<TaskNote>(
      `SELECT n.*, t.title AS task_title
       FROM task_notes n
       LEFT JOIN tasks t ON t.id = n.task_id
       WHERE n.id = ?`,
      id
    )!;

    return {
      id: Number(row.id),
      task_id: row.task_id !== null ? Number(row.task_id) : null,
      task_title: row.task_title ?? null,
      title: row.title ?? '',
      content: row.content,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  });
}

export function deleteNote(db: SqliteDatabase, id: number): { deleted: boolean; id: number } {
  const existing = db.get<{ id: number }>('SELECT id FROM task_notes WHERE id = ?', id);
  if (!existing) {
    throw new AppError(404, 'NOT_FOUND', `Note with id ${id} not found.`);
  }
  db.run('DELETE FROM task_notes WHERE id = ?', id);
  return { deleted: true, id };
}

// ---------------------------------------------------------------------------
// Focus Sessions
// ---------------------------------------------------------------------------

export function listFocusSessionsForTask(db: SqliteDatabase, taskId: number): FocusSession[] {
  const rows = db.all<FocusSession>(
    'SELECT * FROM focus_sessions WHERE task_id = ? ORDER BY started_at DESC, id DESC',
    taskId
  );
  return rows.map((r) => ({
    id: Number(r.id),
    task_id: r.task_id !== null ? Number(r.task_id) : null,
    task_title: r.task_title,
    duration_minutes: Number(r.duration_minutes),
    started_at: r.started_at,
    ended_at: r.ended_at ?? null,
    notes: r.notes ?? '',
    created_at: r.created_at,
  }));
}

export function createFocusSession(
  db: SqliteDatabase,
  input: {
    task_id: number | null;
    duration_minutes: number;
    started_at?: string;
    ended_at?: string | null;
    notes?: string;
  }
): { session: FocusSession; task: Task | null } {
  return db.transaction(() => {
    const now = new Date().toISOString();
    let taskTitle = 'General Focus Session';
    if (input.task_id !== null) {
      const t = getTaskById(db, input.task_id);
      taskTitle = t.title;
    }

    const startedAt = input.started_at || now;
    const endedAt = input.ended_at ?? now;

    const res = db.run(
      `INSERT INTO focus_sessions (task_id, task_title, duration_minutes, started_at, ended_at, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      input.task_id,
      taskTitle,
      input.duration_minutes,
      startedAt,
      endedAt,
      (input.notes ?? '').trim(),
      now
    );

    if (input.task_id !== null) {
      db.run('UPDATE tasks SET updated_at = ? WHERE id = ?', now, input.task_id);
      logActivity(db, {
        entity_type: 'task',
        task_id: input.task_id,
        task_title: taskTitle,
        action: 'focus_logged',
        from_value: null,
        to_value: `${input.duration_minutes}m`,
        created_at: now,
      });
    }

    const row = db.get<FocusSession>(
      'SELECT * FROM focus_sessions WHERE id = ?',
      res.lastInsertRowid
    )!;
    const updatedTask = input.task_id !== null ? getTaskById(db, input.task_id) : null;

    return {
      session: {
        id: Number(row.id),
        task_id: row.task_id !== null ? Number(row.task_id) : null,
        task_title: row.task_title,
        duration_minutes: Number(row.duration_minutes),
        started_at: row.started_at,
        ended_at: row.ended_at ?? null,
        notes: row.notes ?? '',
        created_at: row.created_at,
      },
      task: updatedTask,
    };
  });
}

// ---------------------------------------------------------------------------
// Syllabus Summary
// ---------------------------------------------------------------------------

export function getSyllabusOverview(db: SqliteDatabase): SyllabusOverviewResponse {
  const rows = db.all<{
    part: SyllabusPart;
    title: string;
    official_credits: number;
    official_marks: number;
    note: string;
    course_status: CourseStatus | null;
    updated_at: string;
  }>('SELECT * FROM syllabus_summary ORDER BY part ASC');

  const partToSeedKey: Record<SyllabusPart, string> = {
    'Part A': 'part_a',
    'Part B': 'part_b',
    'Part C': 'part_c',
  };

  let totalOfficialCredits = 0;
  let totalOfficialMarks = 0;
  let totalPlanningCredits = 0;
  let totalPlanningMarks = 0;
  let totalTrackedTasks = 0;

  const parts: SyllabusSummaryItem[] = rows.map((r) => {
    const seedKey = partToSeedKey[r.part];
    const agg = db.get<{
      cnt: number;
      credits_sum: number;
      marks_sum: number;
      completed_cnt: number;
      in_progress_cnt: number;
      not_started_cnt: number;
    }>(
      `SELECT
         COUNT(*) AS cnt,
         COALESCE(SUM(t.credits), 0) AS credits_sum,
         COALESCE(SUM(t.marks), 0) AS marks_sum,
         COALESCE(SUM(CASE WHEN t.status = 'Completed' THEN 1 ELSE 0 END), 0) AS completed_cnt,
         COALESCE(SUM(CASE WHEN t.status = 'In Progress' THEN 1 ELSE 0 END), 0) AS in_progress_cnt,
         COALESCE(SUM(CASE WHEN t.status = 'Not Started' THEN 1 ELSE 0 END), 0) AS not_started_cnt
       FROM tasks t
       JOIN categories c ON c.id = t.category_id
       WHERE c.seed_key = ? AND t.archived_at IS NULL`,
      seedKey
    );

    const officialCredits = Number(r.official_credits) || 0;
    const officialMarks = Number(r.official_marks) || 0;
    const trackedCount = Number(agg?.cnt) || 0;
    const planningCredits = Number(agg?.credits_sum) || 0;
    const planningMarks = Number(agg?.marks_sum) || 0;

    totalOfficialCredits += officialCredits;
    totalOfficialMarks += officialMarks;
    totalPlanningCredits += planningCredits;
    totalPlanningMarks += planningMarks;
    totalTrackedTasks += trackedCount;

    const computed_discrepancy_note =
      r.part === 'Part A'
        ? formatPartAPlanningNote(
            officialCredits,
            officialMarks,
            trackedCount,
            planningCredits,
            planningMarks
          )
        : null;

    return {
      part: r.part,
      title: r.title,
      official_credits: officialCredits,
      official_marks: officialMarks,
      note: r.note,
      course_status: r.part === 'Part C' ? (r.course_status ?? 'Not Started') : null,
      updated_at: r.updated_at,
      tracked_task_count: trackedCount,
      planning_credits_sum: planningCredits,
      planning_marks_sum: planningMarks,
      completed_task_count: Number(agg?.completed_cnt) || 0,
      in_progress_task_count: Number(agg?.in_progress_cnt) || 0,
      not_started_task_count: Number(agg?.not_started_cnt) || 0,
      computed_discrepancy_note,
    };
  });

  return {
    parts,
    teaching_competency_note: TEACHING_COMPETENCY_NOTE,
    official_totals: {
      credits: totalOfficialCredits,
      marks: totalOfficialMarks,
    },
    planning_totals: {
      credits: totalPlanningCredits,
      marks: totalPlanningMarks,
      tracked_tasks: totalTrackedTasks,
    },
  };
}

export function normalizePartParam(rawPart: string): SyllabusPart {
  const cleaned = decodeURIComponent(rawPart).trim().toLowerCase();
  if (cleaned === 'part a' || cleaned === 'part_a' || cleaned === 'a') return 'Part A';
  if (cleaned === 'part b' || cleaned === 'part_b' || cleaned === 'b') return 'Part B';
  if (cleaned === 'part c' || cleaned === 'part_c' || cleaned === 'c') return 'Part C';
  throw new AppError(404, 'NOT_FOUND', `Syllabus part '${rawPart}' not found.`);
}

export function updateSyllabusPart(
  db: SqliteDatabase,
  rawPart: string,
  input: {
    title?: string;
    official_credits?: number;
    official_marks?: number;
    note?: string;
    course_status?: CourseStatus | null;
    confirm?: boolean;
  }
): SyllabusOverviewResponse {
  return db.transaction(() => {
    const part = normalizePartParam(rawPart);
    const existing = db.get<{
      part: SyllabusPart;
      title: string;
      official_credits: number;
      official_marks: number;
      note: string;
      course_status: CourseStatus | null;
    }>('SELECT * FROM syllabus_summary WHERE part = ?', part);

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', `Syllabus summary for ${part} not found.`);
    }

    const creditsChanging =
      input.official_credits !== undefined &&
      Number(input.official_credits) !== Number(existing.official_credits);
    const marksChanging =
      input.official_marks !== undefined &&
      Number(input.official_marks) !== Number(existing.official_marks);

    if ((creditsChanging || marksChanging) && !input.confirm) {
      throw new AppError(
        400,
        'CONFIRMATION_REQUIRED',
        'Confirmation (confirm: true) is required to modify official syllabus totals.'
      );
    }

    const now = new Date().toISOString();
    const nextTitle = input.title !== undefined ? input.title.trim() : existing.title;
    const nextCredits =
      input.official_credits !== undefined
        ? Number(input.official_credits)
        : Number(existing.official_credits);
    const nextMarks =
      input.official_marks !== undefined
        ? Number(input.official_marks)
        : Number(existing.official_marks);
    const nextNote = input.note !== undefined ? input.note.trim() : existing.note;

    let nextCourseStatus: CourseStatus | null = existing.course_status;
    if (part === 'Part C' && input.course_status !== undefined && input.course_status !== null) {
      nextCourseStatus = input.course_status;
    } else if (part !== 'Part C') {
      nextCourseStatus = null;
    }

    db.run(
      `UPDATE syllabus_summary
       SET title = ?, official_credits = ?, official_marks = ?, note = ?, course_status = ?, updated_at = ?
       WHERE part = ?`,
      nextTitle,
      nextCredits,
      nextMarks,
      nextNote,
      nextCourseStatus,
      now,
      part
    );

    // Sync category name and note if changed
    const seedKeyMap: Record<SyllabusPart, string> = {
      'Part A': 'part_a',
      'Part B': 'part_b',
      'Part C': 'part_c',
    };
    db.run(
      `UPDATE categories SET name = ?, note = ?, updated_at = ? WHERE seed_key = ?`,
      nextTitle,
      nextNote,
      now,
      seedKeyMap[part]
    );

    if (part === 'Part C' && nextCourseStatus !== existing.course_status) {
      logActivity(db, {
        entity_type: 'course',
        task_id: null,
        task_title: nextTitle,
        action: 'course_status_changed',
        from_value: existing.course_status ?? 'Not Started',
        to_value: nextCourseStatus,
        created_at: now,
      });
    }

    if (creditsChanging || marksChanging) {
      logActivity(db, {
        entity_type: 'system',
        task_id: null,
        task_title: `${part} Official Totals`,
        action: 'official_totals_updated',
        from_value: `${existing.official_credits} cr / ${existing.official_marks} marks`,
        to_value: `${nextCredits} cr / ${nextMarks} marks`,
        created_at: now,
      });
    }

    return getSyllabusOverview(db);
  });
}

// ---------------------------------------------------------------------------
// Dashboard Summary & Activity
// ---------------------------------------------------------------------------

export function getDashboardSummary(db: SqliteDatabase, todayParam?: string): DashboardSummary {
  const today =
    todayParam && /^\d{4}-\d{2}-\d{2}$/.test(todayParam)
      ? todayParam
      : getLocalTodayYMD();

  const activeRows = db.all<RawTaskRow>(
    `${TASK_SELECT_SQL} WHERE t.archived_at IS NULL ORDER BY t.sort_order ASC, t.id ASC`
  );
  const activeTasks = activeRows.map(mapRawTask);

  const stats = computeTaskStatistics(activeTasks, today);

  const categories = listCategories(db).filter(
    (cat) => cat.seed_key === 'part_a' || cat.seed_key === 'part_b' || cat.seed_key === 'part_c'
  );
  const by_category: CategoryStatusChartRow[] = categories.map((cat) => {
    const catTasks = activeTasks.filter((t) => t.category_id === cat.id);
    const not_started = catTasks.filter((t) => t.status === 'Not Started').length;
    const in_progress = catTasks.filter((t) => t.status === 'In Progress').length;
    const completed = catTasks.filter((t) => t.status === 'Completed').length;

    let short_name = cat.name;
    if (cat.seed_key === 'part_a') short_name = 'Part A';
    else if (cat.seed_key === 'part_b') short_name = 'Part B';
    else if (cat.seed_key === 'part_c') short_name = 'Part C (SWAYAM)';
    else if (cat.name.length > 22) short_name = `${cat.name.slice(0, 20)}…`;

    return {
      category_id: cat.id,
      category_name: cat.name,
      short_name,
      seed_key: cat.seed_key,
      not_started,
      in_progress,
      completed,
      total: catTasks.length,
    };
  });

  // Upcoming / active / submitted list: prioritize overdue/upcoming non-completed tasks first, then keep completed records with due dates or status changes visible
  const withDueOrInProgress = activeTasks
    .filter((t) => t.due_date !== null || t.status === 'In Progress' || t.status === 'Completed')
    .sort((a, b) => {
      const aDone = a.status === 'Completed' ? 1 : 0;
      const bDone = b.status === 'Completed' ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      if (a.due_date && !b.due_date) return -1;
      if (!a.due_date && b.due_date) return 1;
      return a.sort_order - b.sort_order;
    })
    .slice(0, 8);

  return {
    today,
    ...stats,
    by_category,
    upcoming_and_overdue: withDueOrInProgress,
    syllabus: getSyllabusOverview(db),
  };
}

export function getRecentActivity(db: SqliteDatabase, limit = 20): TaskActivity[] {
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const rows = db.all<TaskActivity>(
    'SELECT * FROM task_activity ORDER BY created_at DESC, id DESC LIMIT ?',
    safeLimit
  );
  return rows.map((r) => ({
    ...r,
    id: Number(r.id),
    task_id: r.task_id !== null ? Number(r.task_id) : null,
  }));
}

// ---------------------------------------------------------------------------
// Backup Export
// ---------------------------------------------------------------------------

export function getFullBackupJson(db: SqliteDatabase) {
  return {
    exported_at: new Date().toISOString(),
    schema_version: 2,
    profile: getProfile(db),
    settings: getSettings(db),
    categories: listCategories(db),
    syllabus_summary: getSyllabusOverview(db),
    tasks: db.all('SELECT * FROM tasks ORDER BY sort_order ASC, id ASC'),
    subtasks: db.all('SELECT * FROM subtasks ORDER BY task_id ASC, sort_order ASC, id ASC'),
    task_notes: db.all('SELECT * FROM task_notes ORDER BY id ASC'),
    focus_sessions: db.all('SELECT * FROM focus_sessions ORDER BY id ASC'),
    task_activity: db.all('SELECT * FROM task_activity ORDER BY id ASC'),
  };
}

export function importFullBackupJson(
  db: SqliteDatabase,
  backup: {
    profile?: Record<string, unknown>;
    settings?: Record<string, unknown>;
    categories?: Array<Record<string, unknown>>;
    tasks: Array<Record<string, unknown>>;
    subtasks?: Array<Record<string, unknown>>;
    task_notes?: Array<Record<string, unknown>>;
    focus_sessions?: Array<Record<string, unknown>>;
  }
): { imported_tasks: number; imported_notes: number; imported_subtasks: number } {
  return db.transaction(() => {
    const now = new Date().toISOString();

    if (backup.profile) {
      const p = backup.profile;
      db.run(
        `UPDATE student_profile
         SET name = ?, roll_number = ?, university = ?, programme = ?, semester = ?,
             syllabus_pattern = ?, academic_year = ?, college = ?, teaching_subject = ?, updated_at = ?
         WHERE id = 1`,
        String(p.name ?? ''),
        String(p.roll_number ?? ''),
        String(p.university ?? 'TNTEU'),
        String(p.programme ?? 'B.Ed.'),
        Number(p.semester) || 3,
        String(p.syllabus_pattern ?? 'CBCS 2021–2022'),
        String(p.academic_year ?? '2025–2027'),
        String(p.college ?? ''),
        String(p.teaching_subject ?? ''),
        now
      );
    }

    if (backup.settings) {
      const s = backup.settings;
      const theme = s.theme === 'dark' ? 'dark' : 'light';
      const weekStart = s.week_start === 'Sun' ? 'Sun' : 'Mon';
      const dateFormat =
        s.date_format === 'MM/DD/YYYY' || s.date_format === 'YYYY-MM-DD'
          ? s.date_format
          : 'DD/MM/YYYY';
      const timeFormat = s.time_format === '24h' ? '24h' : '12h';
      db.run(
        `UPDATE app_settings
         SET theme = ?, week_start = ?, date_format = ?, time_format = ?, updated_at = ?
         WHERE id = 1`,
        theme,
        weekStart,
        dateFormat,
        timeFormat,
        now
      );
    }

    // Clear existing tasks and dependent rows before importing snapshot
    db.run('DELETE FROM subtasks');
    db.run('DELETE FROM task_notes');
    db.run('DELETE FROM focus_sessions');
    db.run('DELETE FROM tasks');

    // Ensure categories exist and map old category IDs -> current category IDs
    const catIdMap = new Map<number, number>();
    const existingCats = listCategories(db);
    const defaultCatId = existingCats[0]?.id ?? 1;

    if (Array.isArray(backup.categories)) {
      for (const c of backup.categories) {
        const oldId = Number(c.id);
        const seedKey = typeof c.seed_key === 'string' ? c.seed_key : null;
        const name = String(c.name ?? 'Custom').trim() || 'Custom';
        const desc = String(c.description ?? '');
        const note = String(c.note ?? '');
        const sortOrder = Number(c.sort_order) || 1;

        if (seedKey) {
          const match = db.get<{ id: number }>(
            'SELECT id FROM categories WHERE seed_key = ?',
            seedKey
          );
          if (match) {
            db.run(
              'UPDATE categories SET name = ?, description = ?, note = ?, updated_at = ? WHERE id = ?',
              name,
              desc,
              note,
              now,
              match.id
            );
            catIdMap.set(oldId, Number(match.id));
            continue;
          }
        }

        const byName = db.get<{ id: number }>(
          'SELECT id FROM categories WHERE LOWER(name) = LOWER(?)',
          name
        );
        if (byName) {
          catIdMap.set(oldId, Number(byName.id));
        } else {
          const ins = db.run(
            `INSERT INTO categories (seed_key, name, description, note, sort_order, created_at, updated_at)
             VALUES (NULL, ?, ?, ?, ?, ?, ?)`,
            name,
            desc,
            note,
            sortOrder,
            now,
            now
          );
          catIdMap.set(oldId, ins.lastInsertRowid);
        }
      }
    }

    const taskIdMap = new Map<number, number>();
    let importedTasks = 0;

    for (const t of backup.tasks) {
      const oldTaskId = Number(t.id);
      const mappedCatId = catIdMap.get(Number(t.category_id)) ?? defaultCatId;
      const seedKey = typeof t.seed_key === 'string' && t.seed_key ? t.seed_key : null;
      const title = String(t.title ?? 'Untitled Record').trim() || 'Untitled Record';
      const level =
        t.level === 'Level I' || t.level === 'Level II' ? t.level : 'N/A';
      const status =
        t.status === 'In Progress' || t.status === 'Completed' ? t.status : 'Not Started';
      const difficulty =
        t.difficulty === 'Easy' || t.difficulty === 'Hard' ? t.difficulty : 'Medium';
      const priority =
        t.priority === 'Low' || t.priority === 'High' || t.priority === 'Urgent'
          ? t.priority
          : 'Normal';

      const ins = db.run(
        `INSERT INTO tasks (
           seed_key, title, category_id, level, status, difficulty, priority,
           start_date, due_date, notes, estimated_minutes, credits, marks,
           manual_minutes_adjustment, sort_order, created_at, updated_at,
           completed_at, archived_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        seedKey,
        title,
        mappedCatId,
        level,
        status,
        difficulty,
        priority,
        typeof t.start_date === 'string' ? t.start_date : null,
        typeof t.due_date === 'string' ? t.due_date : null,
        String(t.notes ?? ''),
        Math.max(0, Number(t.estimated_minutes) || 0),
        Math.max(0, Number(t.credits) || 0),
        Math.max(0, Number(t.marks) || 0),
        Number(t.manual_minutes_adjustment) || 0,
        Number(t.sort_order) || importedTasks + 1,
        typeof t.created_at === 'string' ? t.created_at : now,
        now,
        typeof t.completed_at === 'string' ? t.completed_at : null,
        typeof t.archived_at === 'string' ? t.archived_at : null
      );

      taskIdMap.set(oldTaskId, ins.lastInsertRowid);
      importedTasks++;
    }

    let importedSubtasks = 0;
    if (Array.isArray(backup.subtasks)) {
      for (const st of backup.subtasks) {
        const newTaskId = taskIdMap.get(Number(st.task_id));
        if (!newTaskId) continue;
        db.run(
          `INSERT INTO subtasks (task_id, title, done, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          newTaskId,
          String(st.title ?? 'Subtask').trim() || 'Subtask',
          st.done ? 1 : 0,
          Number(st.sort_order) || importedSubtasks + 1,
          typeof st.created_at === 'string' ? st.created_at : now,
          now
        );
        importedSubtasks++;
      }
    }

    let importedNotes = 0;
    if (Array.isArray(backup.task_notes)) {
      for (const n of backup.task_notes) {
        const rawTid = n.task_id !== null && n.task_id !== undefined ? Number(n.task_id) : null;
        const mappedTid = rawTid !== null ? (taskIdMap.get(rawTid) ?? null) : null;
        const content = String(n.content ?? '').trim();
        if (!content) continue;
        db.run(
          `INSERT INTO task_notes (task_id, title, content, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
          mappedTid,
          String(n.title ?? '').trim(),
          content,
          typeof n.created_at === 'string' ? n.created_at : now,
          now
        );
        importedNotes++;
      }
    }

    if (Array.isArray(backup.focus_sessions)) {
      for (const fs of backup.focus_sessions) {
        const rawTid =
          fs.task_id !== null && fs.task_id !== undefined ? Number(fs.task_id) : null;
        const mappedTid = rawTid !== null ? (taskIdMap.get(rawTid) ?? null) : null;
        db.run(
          `INSERT INTO focus_sessions (task_id, task_title, duration_minutes, started_at, ended_at, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          mappedTid,
          String(fs.task_title ?? 'Focus Session'),
          Math.max(1, Number(fs.duration_minutes) || 25),
          typeof fs.started_at === 'string' ? fs.started_at : now,
          typeof fs.ended_at === 'string' ? fs.ended_at : now,
          String(fs.notes ?? ''),
          typeof fs.created_at === 'string' ? fs.created_at : now
        );
      }
    }

    logActivity(db, {
      entity_type: 'system',
      task_id: null,
      task_title: 'Backup Restore',
      action: 'backup_imported',
      from_value: null,
      to_value: `${importedTasks} records, ${importedSubtasks} subtasks, ${importedNotes} notes`,
      created_at: now,
    });

    return {
      imported_tasks: importedTasks,
      imported_notes: importedNotes,
      imported_subtasks: importedSubtasks,
    };
  });
}

