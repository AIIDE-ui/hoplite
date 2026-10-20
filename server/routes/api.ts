import { Router, type Request, type Response } from 'express';
import { getDb, getUserDb, type SqliteDatabase } from '../db/connection.ts';
import { executeRestoreSyllabus, previewRestoreSyllabus } from '../db/seed.ts';
import { AppError } from '../errors.ts';
import {
  deleteUserByAdmin,
  getAdminAnalytics,
  getAdminFromSessionToken,
  getAuthSessionOverview,
  getUserFromSessionToken,
  loginAdmin,
  loginUser,
  logoutAdminSession,
  logoutSession,
  registerUser,
  updateAdminCredentials,
  updateUserByAdmin,
} from '../services/authService.ts';
import {
  bulkUpdateTasks,
  createCategory,
  createFocusSession,
  createNote,
  createSubtask,
  createTask,
  deleteCategory,
  deleteNote,
  deleteSubtask,
  getDashboardSummary,
  getFullBackupJson,
  getProfile,
  getRecentActivity,
  getSettings,
  getSyllabusOverview,
  getTaskDetailById,
  importFullBackupJson,
  listCategories,
  listFocusSessionsForTask,
  listNotes,
  listSubtasksForTask,
  listTasks,
  permanentDeleteTask,
  reorderTasks,
  restoreTask,
  softDeleteTask,
  updateCategory,
  updateNote,
  updateProfile,
  updateSettings,
  updateSubtask,
  updateSyllabusPart,
  updateTask,
} from '../services/trackerService.ts';
import {
  adminCredentialsUpdateSchema,
  adminLoginSchema,
  adminUserUpdateSchema,
  authLoginSchema,
  authRegisterSchema,
  backupImportSchema,
  categoryCreateSchema,
  categoryUpdateSchema,
  focusSessionCreateSchema,
  noteCreateSchema,
  noteUpdateSchema,
  parseWithSchema,
  profileUpdateSchema,
  restoreSyllabusSchema,
  settingsUpdateSchema,
  subtaskCreateSchema,
  subtaskUpdateSchema,
  syllabusUpdateSchema,
  taskBulkSchema,
  taskCreateSchema,
  taskReorderSchema,
  taskUpdateSchema,
} from '../validation/schemas.ts';

const SESSION_COOKIE_NAME = 'bed_session';
const ADMIN_SESSION_COOKIE_NAME = 'bed_admin_session';

function parseIdParam(raw: string, label = 'id'): number {
  const num = Number(raw);
  if (!Number.isInteger(num) || num <= 0) {
    throw new AppError(400, 'INVALID_ID', `Invalid ${label} parameter.`);
  }
  return num;
}

function extractCookieToken(req: Request, cookieName: string): string | null {
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const parts = cookieHeader.split(';');
    for (const part of parts) {
      const [rawKey, ...rest] = part.trim().split('=');
      if (rawKey === cookieName) {
        const val = rest.join('=').trim();
        if (val) return decodeURIComponent(val);
      }
    }
  }
  return null;
}

function extractSessionToken(req: Request): string | null {
  return extractCookieToken(req, SESSION_COOKIE_NAME);
}

function extractAdminSessionToken(req: Request): string | null {
  return extractCookieToken(req, ADMIN_SESSION_COOKIE_NAME);
}

function formatCookieHeader(
  req: Request,
  name: string,
  value: string,
  maxAgeSeconds: number
): string {
  const isHttps =
    req.secure ||
    String(req.headers['x-forwarded-proto'] || '')
      .toLowerCase()
      .includes('https');
  const cookieAttrs = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (isHttps) {
    cookieAttrs.push('SameSite=None', 'Secure', 'Partitioned');
  } else {
    cookieAttrs.push('SameSite=Lax');
  }
  return cookieAttrs.join('; ');
}

function setSessionCookie(req: Request, res: Response, token: string): void {
  const maxAge = 30 * 24 * 60 * 60; // 30 days
  // Clear any admin session cookie when a regular student account logs in
  res.setHeader('Set-Cookie', [
    formatCookieHeader(req, SESSION_COOKIE_NAME, token, maxAge),
    formatCookieHeader(req, ADMIN_SESSION_COOKIE_NAME, '', 0),
  ]);
}

function clearSessionCookie(req: Request, res: Response): void {
  res.setHeader('Set-Cookie', formatCookieHeader(req, SESSION_COOKIE_NAME, '', 0));
}

function setAdminSessionCookie(req: Request, res: Response, token: string): void {
  const maxAge = 7 * 24 * 60 * 60; // 7 days
  // Clear any student session cookie when admin logs in so admin dashboard is strictly separate
  res.setHeader('Set-Cookie', [
    formatCookieHeader(req, ADMIN_SESSION_COOKIE_NAME, token, maxAge),
    formatCookieHeader(req, SESSION_COOKIE_NAME, '', 0),
  ]);
}

function clearAdminSessionCookie(req: Request, res: Response): void {
  res.setHeader('Set-Cookie', formatCookieHeader(req, ADMIN_SESSION_COOKIE_NAME, '', 0));
}

function getActiveDb(req: Request): SqliteDatabase {
  const primaryDb = getDb();
  const token = extractSessionToken(req);
  if (!token) return primaryDb;
  const user = getUserFromSessionToken(primaryDb, token);
  if (!user) return primaryDb;
  return getUserDb(user.db_filename, primaryDb);
}

function requireAdminAccess(req: Request): SqliteDatabase {
  const primaryDb = getDb();
  const userToken = extractSessionToken(req);
  const currentUser = getUserFromSessionToken(primaryDb, userToken);
  if (currentUser !== null) {
    throw new AppError(
      403,
      'FORBIDDEN',
      'Admin analytics dashboard is not accessible to student workspace accounts.'
    );
  }
  const adminToken = extractAdminSessionToken(req);
  const admin = getAdminFromSessionToken(primaryDb, adminToken);
  if (!admin) {
    throw new AppError(401, 'ADMIN_UNAUTHORIZED', 'Admin authentication required.');
  }
  return primaryDb;
}

export function createApiRouter(): Router {
  const router = Router();

  // Health
  router.get('/health', (_req: Request, res: Response) => {
    const db = getDb();
    const row = db.get<{ ok: number }>('SELECT 1 AS ok');
    res.json({
      data: {
        status: row?.ok === 1 ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
      },
    });
  });

  // Multi-User Workspace Authentication (Separate SQLite databases per student/friend)
  router.get('/auth/session', (req: Request, res: Response) => {
    const primaryDb = getDb();
    const token = extractSessionToken(req);
    const adminToken = extractAdminSessionToken(req);
    const data = getAuthSessionOverview(primaryDb, token, adminToken);
    res.json({ data });
  });

  router.post('/auth/register', (req: Request, res: Response) => {
    const primaryDb = getDb();
    const parsed = parseWithSchema(authRegisterSchema, req.body);
    const { token } = registerUser(primaryDb, parsed);
    logoutAdminSession(primaryDb, extractAdminSessionToken(req));
    setSessionCookie(req, res, token);
    const data = getAuthSessionOverview(primaryDb, token, null);
    res.status(201).json({ data });
  });

  router.post('/auth/login', (req: Request, res: Response) => {
    const primaryDb = getDb();
    const parsed = parseWithSchema(authLoginSchema, req.body);
    const { token } = loginUser(primaryDb, parsed);
    logoutAdminSession(primaryDb, extractAdminSessionToken(req));
    setSessionCookie(req, res, token);
    const data = getAuthSessionOverview(primaryDb, token, null);
    res.json({ data });
  });

  router.post('/auth/logout', (req: Request, res: Response) => {
    const primaryDb = getDb();
    const token = extractSessionToken(req);
    logoutSession(primaryDb, token);
    clearSessionCookie(req, res);
    const data = getAuthSessionOverview(primaryDb, null, extractAdminSessionToken(req));
    res.json({ data });
  });

  // Separate Admin Authentication & Simple Analytics
  router.post('/admin/login', (req: Request, res: Response) => {
    const primaryDb = getDb();
    const parsed = parseWithSchema(adminLoginSchema, req.body);
    const { token } = loginAdmin(primaryDb, parsed);
    // Log out any active student session so admin session is isolated
    logoutSession(primaryDb, extractSessionToken(req));
    setAdminSessionCookie(req, res, token);
    const data = getAuthSessionOverview(primaryDb, null, token);
    res.json({ data });
  });

  router.post('/admin/logout', (req: Request, res: Response) => {
    const primaryDb = getDb();
    const adminToken = extractAdminSessionToken(req);
    logoutAdminSession(primaryDb, adminToken);
    clearAdminSessionCookie(req, res);
    const data = getAuthSessionOverview(primaryDb, extractSessionToken(req), null);
    res.json({ data });
  });

  router.get('/admin/analytics', (req: Request, res: Response) => {
    const primaryDb = requireAdminAccess(req);
    const data = getAdminAnalytics(primaryDb);
    res.json({ data });
  });

  router.put('/admin/credentials', (req: Request, res: Response) => {
    const primaryDb = requireAdminAccess(req);
    const parsed = parseWithSchema(adminCredentialsUpdateSchema, req.body);
    const data = updateAdminCredentials(primaryDb, parsed);
    res.json({ data });
  });

  router.put('/admin/users/:id', (req: Request, res: Response) => {
    const primaryDb = requireAdminAccess(req);
    const userId = parseIdParam(String(req.params.id), 'user id');
    const parsed = parseWithSchema(adminUserUpdateSchema, req.body);
    const data = updateUserByAdmin(primaryDb, userId, parsed);
    res.json({ data });
  });

  router.delete('/admin/users/:id', (req: Request, res: Response) => {
    const primaryDb = requireAdminAccess(req);
    const userId = parseIdParam(String(req.params.id), 'user id');
    const data = deleteUserByAdmin(primaryDb, userId);
    res.json({ data });
  });

  // Profile
  router.get('/profile', (req: Request, res: Response) => {
    const data = getProfile(getActiveDb(req));
    res.json({ data });
  });

  router.put('/profile', (req: Request, res: Response) => {
    const parsed = parseWithSchema(profileUpdateSchema, req.body);
    const data = updateProfile(getActiveDb(req), parsed);
    res.json({ data });
  });

  // Settings
  router.get('/settings', (req: Request, res: Response) => {
    const data = getSettings(getActiveDb(req));
    res.json({ data });
  });

  router.put('/settings', (req: Request, res: Response) => {
    const parsed = parseWithSchema(settingsUpdateSchema, req.body);
    const data = updateSettings(getActiveDb(req), parsed);
    res.json({ data });
  });

  // Categories
  router.get('/categories', (req: Request, res: Response) => {
    const data = listCategories(getActiveDb(req));
    res.json({ data });
  });

  router.post('/categories', (req: Request, res: Response) => {
    const parsed = parseWithSchema(categoryCreateSchema, req.body);
    const data = createCategory(getActiveDb(req), parsed);
    res.status(201).json({ data });
  });

  router.put('/categories/:id', (req: Request, res: Response) => {
    const id = parseIdParam(String(req.params.id), 'category id');
    const parsed = parseWithSchema(categoryUpdateSchema, req.body);
    const data = updateCategory(getActiveDb(req), id, parsed);
    res.json({ data });
  });

  router.delete('/categories/:id', (req: Request, res: Response) => {
    const id = parseIdParam(String(req.params.id), 'category id');
    const data = deleteCategory(getActiveDb(req), id);
    res.json({ data });
  });

  // Restore Syllabus (supported at both /api/restore-syllabus and /api/tasks/restore-syllabus)
  const handleRestorePreview = (req: Request, res: Response) => {
    const data = previewRestoreSyllabus(getActiveDb(req));
    res.json({ data });
  };

  const handleRestoreExecute = (req: Request, res: Response) => {
    const parsed = parseWithSchema(restoreSyllabusSchema, req.body ?? {});
    const db = getActiveDb(req);
    if (parsed.dryRun) {
      const preview = previewRestoreSyllabus(db);
      res.json({ data: { dryRun: true, preview } });
      return;
    }
    if (!parsed.confirm) {
      throw new AppError(
        400,
        'CONFIRMATION_REQUIRED',
        'Confirmation (confirm: true) is required to restore the original syllabus.'
      );
    }
    const data = executeRestoreSyllabus(db);
    res.json({ data });
  };

  router.get('/restore-syllabus/preview', handleRestorePreview);
  router.post('/restore-syllabus', handleRestoreExecute);
  router.get('/tasks/restore-syllabus/preview', handleRestorePreview);
  router.post('/tasks/restore-syllabus', handleRestoreExecute);

  // Task Reorder & Bulk (registered before /tasks/:id)
  router.put('/tasks/reorder', (req: Request, res: Response) => {
    const parsed = parseWithSchema(taskReorderSchema, req.body);
    const data = reorderTasks(getActiveDb(req), parsed);
    res.json({ data });
  });

  router.patch('/tasks/bulk', (req: Request, res: Response) => {
    const parsed = parseWithSchema(taskBulkSchema, req.body);
    const data = bulkUpdateTasks(getActiveDb(req), parsed);
    res.json({ data });
  });

  // Tasks CRUD
  router.get('/tasks', (req: Request, res: Response) => {
    const q = req.query;
    const archivedParam = String(q.archived ?? '').toLowerCase();
    const archived = archivedParam === 'true' || archivedParam === '1';

    const data = listTasks(getActiveDb(req), {
      search: typeof q.search === 'string' ? q.search : undefined,
      category: typeof q.category === 'string' ? q.category : undefined,
      status: typeof q.status === 'string' ? q.status : undefined,
      difficulty: typeof q.difficulty === 'string' ? q.difficulty : undefined,
      priority: typeof q.priority === 'string' ? q.priority : undefined,
      due: typeof q.due === 'string' ? q.due : undefined,
      dueFrom: typeof q.dueFrom === 'string' ? q.dueFrom : undefined,
      dueTo: typeof q.dueTo === 'string' ? q.dueTo : undefined,
      sort: typeof q.sort === 'string' ? q.sort : undefined,
      order: typeof q.order === 'string' ? q.order : undefined,
      page: q.page ? Number(q.page) : 1,
      pageSize: q.pageSize ? Number(q.pageSize) : 20,
      archived,
      today: typeof q.today === 'string' ? q.today : undefined,
    });
    res.json({ data });
  });

  router.post('/tasks', (req: Request, res: Response) => {
    const parsed = parseWithSchema(taskCreateSchema, req.body);
    const data = createTask(getActiveDb(req), parsed);
    res.status(201).json({ data });
  });

  router.get('/tasks/:id', (req: Request, res: Response) => {
    const id = parseIdParam(String(req.params.id), 'task id');
    const data = getTaskDetailById(getActiveDb(req), id);
    res.json({ data });
  });

  router.put('/tasks/:id', (req: Request, res: Response) => {
    const id = parseIdParam(String(req.params.id), 'task id');
    const parsed = parseWithSchema(taskUpdateSchema, req.body);
    const data = updateTask(getActiveDb(req), id, parsed);
    res.json({ data });
  });

  router.delete('/tasks/:id', (req: Request, res: Response) => {
    const id = parseIdParam(String(req.params.id), 'task id');
    const data = softDeleteTask(getActiveDb(req), id);
    res.json({ data });
  });

  router.post('/tasks/:id/restore', (req: Request, res: Response) => {
    const id = parseIdParam(String(req.params.id), 'task id');
    const data = restoreTask(getActiveDb(req), id);
    res.json({ data });
  });

  router.delete('/tasks/:id/permanent', (req: Request, res: Response) => {
    const id = parseIdParam(String(req.params.id), 'task id');
    const data = permanentDeleteTask(getActiveDb(req), id);
    res.json({ data });
  });

  // Subtasks
  router.get('/tasks/:id/subtasks', (req: Request, res: Response) => {
    const taskId = parseIdParam(String(req.params.id), 'task id');
    const data = listSubtasksForTask(getActiveDb(req), taskId);
    res.json({ data });
  });

  router.post('/tasks/:id/subtasks', (req: Request, res: Response) => {
    const taskId = parseIdParam(String(req.params.id), 'task id');
    const parsed = parseWithSchema(subtaskCreateSchema, req.body);
    const data = createSubtask(getActiveDb(req), taskId, parsed);
    res.status(201).json({ data });
  });

  router.put('/subtasks/:id', (req: Request, res: Response) => {
    const id = parseIdParam(String(req.params.id), 'subtask id');
    const parsed = parseWithSchema(subtaskUpdateSchema, req.body);
    const data = updateSubtask(getActiveDb(req), id, parsed);
    res.json({ data });
  });

  router.delete('/subtasks/:id', (req: Request, res: Response) => {
    const id = parseIdParam(String(req.params.id), 'subtask id');
    const data = deleteSubtask(getActiveDb(req), id);
    res.json({ data });
  });

  // Focus Sessions
  router.get('/tasks/:id/focus-sessions', (req: Request, res: Response) => {
    const taskId = parseIdParam(String(req.params.id), 'task id');
    const data = listFocusSessionsForTask(getActiveDb(req), taskId);
    res.json({ data });
  });

  router.post('/tasks/:id/focus-sessions', (req: Request, res: Response) => {
    const taskId = parseIdParam(String(req.params.id), 'task id');
    const parsed = parseWithSchema(focusSessionCreateSchema, {
      ...req.body,
      task_id: taskId,
    });
    const data = createFocusSession(getActiveDb(req), parsed);
    res.status(201).json({ data });
  });

  // Notes
  router.get('/notes', (req: Request, res: Response) => {
    const taskId = typeof req.query.taskId === 'string' ? req.query.taskId : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const data = listNotes(getActiveDb(req), { taskId, search });
    res.json({ data });
  });

  router.post('/notes', (req: Request, res: Response) => {
    const parsed = parseWithSchema(noteCreateSchema, req.body);
    const data = createNote(getActiveDb(req), parsed);
    res.status(201).json({ data });
  });

  router.put('/notes/:id', (req: Request, res: Response) => {
    const id = parseIdParam(String(req.params.id), 'note id');
    const parsed = parseWithSchema(noteUpdateSchema, req.body);
    const data = updateNote(getActiveDb(req), id, parsed);
    res.json({ data });
  });

  router.delete('/notes/:id', (req: Request, res: Response) => {
    const id = parseIdParam(String(req.params.id), 'note id');
    const data = deleteNote(getActiveDb(req), id);
    res.json({ data });
  });

  // Dashboard
  router.get('/dashboard/summary', (req: Request, res: Response) => {
    const today = typeof req.query.today === 'string' ? req.query.today : undefined;
    const data = getDashboardSummary(getActiveDb(req), today);
    res.json({ data });
  });

  router.get('/dashboard/activity', (req: Request, res: Response) => {
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const data = getRecentActivity(getActiveDb(req), limit);
    res.json({ data });
  });

  // Syllabus
  router.get('/syllabus', (req: Request, res: Response) => {
    const data = getSyllabusOverview(getActiveDb(req));
    res.json({ data });
  });

  router.put('/syllabus/:part', (req: Request, res: Response) => {
    const parsed = parseWithSchema(syllabusUpdateSchema, req.body);
    const data = updateSyllabusPart(getActiveDb(req), String(req.params.part), parsed);
    res.json({ data });
  });

  // Backup JSON Export & Import
  router.get('/backup/json', (req: Request, res: Response) => {
    const data = getFullBackupJson(getActiveDb(req));
    res.json({ data });
  });

  router.post('/backup/import', (req: Request, res: Response) => {
    const parsed = parseWithSchema(backupImportSchema, req.body);
    const data = importFullBackupJson(getActiveDb(req), parsed.backup);
    res.json({ data });
  });

  // Catch-all for unknown /api paths
  router.use((_req: Request, res: Response) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Unknown API endpoint.',
      },
    });
  });

  return router;
}
