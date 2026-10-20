import crypto from 'node:crypto';
import type {
  AdminAnalyticsResponse,
  AdminWorkspaceStat,
  AuthSessionResponse,
  AuthUser,
  CourseStatus,
} from '../../src/shared/constants.ts';
import { calculateCompletionPercentage, getLocalTodayYMD } from '../../src/shared/stats.ts';
import { getUserDb, removeUserDb, type SqliteDatabase } from '../db/connection.ts';
import { AppError } from '../errors.ts';

interface RawUserRow {
  id: number;
  username: string;
  display_name: string;
  roll_number: string;
  password_hash: string;
  password_salt: string;
  db_filename: string;
  created_at: string;
  updated_at: string;
}

interface RawAdminRow {
  id: number;
  username: string;
  password_hash: string;
  password_salt: string;
  updated_at: string;
}

function hashPassword(password: string, saltHex: string): string {
  return crypto.scryptSync(password, saltHex, 64).toString('hex');
}

function toAuthUser(row: RawUserRow): AuthUser {
  return {
    id: Number(row.id),
    username: row.username,
    display_name: row.display_name,
    roll_number: row.roll_number ?? '',
    db_filename: row.db_filename,
    created_at: row.created_at,
  };
}

function createSessionToken(primaryDb: SqliteDatabase, userId: number): string {
  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
  primaryDb.run(
    `INSERT INTO user_sessions (token, user_id, created_at, expires_at)
     VALUES (?, ?, ?, ?)`,
    token,
    userId,
    now.toISOString(),
    expires.toISOString()
  );
  return token;
}

export function ensureAdminSeed(primaryDb: SqliteDatabase): RawAdminRow {
  const rawEnvUser = (process.env.ADMIN_USERNAME || '').trim().toLowerCase();
  const defaultUsername =
    rawEnvUser && !rawEnvUser.startsWith('my_') ? rawEnvUser : 'admin';
  const rawEnvPass = (process.env.ADMIN_PASSWORD || '').trim();
  const defaultPassword =
    rawEnvPass && !rawEnvPass.toUpperCase().startsWith('MY_') ? rawEnvPass : 'admin123';

  const existing = primaryDb.get<RawAdminRow>('SELECT * FROM admin_credentials WHERE id = 1');
  if (existing) {
    const isFactoryDefault =
      existing.username.toLowerCase() === 'admin' &&
      hashPassword('admin123', existing.password_salt) === existing.password_hash;
    if (isFactoryDefault && (defaultUsername !== 'admin' || defaultPassword !== 'admin123')) {
      const saltHex = crypto.randomBytes(16).toString('hex');
      const passwordHash = hashPassword(defaultPassword, saltHex);
      const now = new Date().toISOString();
      primaryDb.run(
        `UPDATE admin_credentials
         SET username = ?, password_hash = ?, password_salt = ?, updated_at = ?
         WHERE id = 1`,
        defaultUsername,
        passwordHash,
        saltHex,
        now
      );
      return primaryDb.get<RawAdminRow>('SELECT * FROM admin_credentials WHERE id = 1')!;
    }
    return existing;
  }

  const saltHex = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(defaultPassword, saltHex);
  const now = new Date().toISOString();

  primaryDb.run(
    `INSERT INTO admin_credentials (id, username, password_hash, password_salt, updated_at)
     VALUES (1, ?, ?, ?, ?)`,
    defaultUsername,
    passwordHash,
    saltHex,
    now
  );

  return primaryDb.get<RawAdminRow>('SELECT * FROM admin_credentials WHERE id = 1')!;
}

function createAdminSessionToken(primaryDb: SqliteDatabase): string {
  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
  primaryDb.run(
    `INSERT INTO admin_sessions (token, created_at, expires_at)
     VALUES (?, ?, ?)`,
    token,
    now.toISOString(),
    expires.toISOString()
  );
  return token;
}

export function loginAdmin(
  primaryDb: SqliteDatabase,
  input: { username: string; password: string }
): { username: string; token: string } {
  const adminRow = ensureAdminSeed(primaryDb);
  if (adminRow.username.toLowerCase() !== input.username.trim().toLowerCase()) {
    throw new AppError(401, 'INVALID_ADMIN_CREDENTIALS', 'Invalid admin username or password.');
  }

  const computedHash = hashPassword(input.password, adminRow.password_salt);
  const expectedBuf = Buffer.from(adminRow.password_hash, 'hex');
  const actualBuf = Buffer.from(computedHash, 'hex');

  if (
    expectedBuf.length !== actualBuf.length ||
    !crypto.timingSafeEqual(expectedBuf, actualBuf)
  ) {
    throw new AppError(401, 'INVALID_ADMIN_CREDENTIALS', 'Invalid admin username or password.');
  }

  const token = createAdminSessionToken(primaryDb);
  return { username: adminRow.username, token };
}

export function logoutAdminSession(primaryDb: SqliteDatabase, token: string | null): void {
  if (!token) return;
  primaryDb.run('DELETE FROM admin_sessions WHERE token = ?', token);
}

export function getAdminFromSessionToken(
  primaryDb: SqliteDatabase,
  token: string | null
): { username: string } | null {
  if (!token) return null;
  const now = new Date().toISOString();
  const session = primaryDb.get<{ token: string }>(
    'SELECT token FROM admin_sessions WHERE token = ? AND expires_at > ?',
    token,
    now
  );
  if (!session) return null;
  const adminRow = ensureAdminSeed(primaryDb);
  return { username: adminRow.username };
}

export function updateAdminCredentials(
  primaryDb: SqliteDatabase,
  input: {
    current_password: string;
    new_username?: string;
    new_password: string;
  }
): { username: string; updated_at: string } {
  const adminRow = ensureAdminSeed(primaryDb);
  const computedHash = hashPassword(input.current_password, adminRow.password_salt);
  const expectedBuf = Buffer.from(adminRow.password_hash, 'hex');
  const actualBuf = Buffer.from(computedHash, 'hex');

  if (
    expectedBuf.length !== actualBuf.length ||
    !crypto.timingSafeEqual(expectedBuf, actualBuf)
  ) {
    throw new AppError(401, 'INVALID_ADMIN_CREDENTIALS', 'Current admin password is incorrect.', {
      current_password: 'Current admin password is incorrect.',
    });
  }

  const nextUsername = input.new_username
    ? input.new_username.trim().toLowerCase()
    : adminRow.username;
  const newSaltHex = crypto.randomBytes(16).toString('hex');
  const newPasswordHash = hashPassword(input.new_password, newSaltHex);
  const now = new Date().toISOString();

  primaryDb.run(
    `UPDATE admin_credentials
     SET username = ?, password_hash = ?, password_salt = ?, updated_at = ?
     WHERE id = 1`,
    nextUsername,
    newPasswordHash,
    newSaltHex,
    now
  );

  return { username: nextUsername, updated_at: now };
}

function collectWorkspaceStats(
  db: SqliteDatabase,
  meta: { id: string; label: string; username: string; roll_number?: string },
  today: string
): AdminWorkspaceStat {
  const profile = db.get<{
    name: string;
    roll_number: string;
    college: string;
  }>('SELECT name, roll_number, college FROM student_profile WHERE id = 1');

  const taskAgg = db.get<{
    total: number;
    completed: number;
    in_progress: number;
    not_started: number;
    overdue: number;
    part_a_completed: number;
    part_a_total: number;
    part_b_completed: number;
    part_b_total: number;
    last_updated: string | null;
  }>(
    `SELECT
       COUNT(*) AS total,
       COALESCE(SUM(CASE WHEN t.status = 'Completed' THEN 1 ELSE 0 END), 0) AS completed,
       COALESCE(SUM(CASE WHEN t.status = 'In Progress' THEN 1 ELSE 0 END), 0) AS in_progress,
       COALESCE(SUM(CASE WHEN t.status = 'Not Started' THEN 1 ELSE 0 END), 0) AS not_started,
       COALESCE(SUM(CASE WHEN t.status != 'Completed' AND t.due_date IS NOT NULL AND t.due_date < ? THEN 1 ELSE 0 END), 0) AS overdue,
       COALESCE(SUM(CASE WHEN c.seed_key = 'part_a' AND t.status = 'Completed' THEN 1 ELSE 0 END), 0) AS part_a_completed,
       COALESCE(SUM(CASE WHEN c.seed_key = 'part_a' THEN 1 ELSE 0 END), 0) AS part_a_total,
       COALESCE(SUM(CASE WHEN c.seed_key = 'part_b' AND t.status = 'Completed' THEN 1 ELSE 0 END), 0) AS part_b_completed,
       COALESCE(SUM(CASE WHEN c.seed_key = 'part_b' THEN 1 ELSE 0 END), 0) AS part_b_total,
       MAX(t.updated_at) AS last_updated
     FROM tasks t
     JOIN categories c ON c.id = t.category_id
     WHERE t.archived_at IS NULL`,
    today
  );

  const partCRow = db.get<{ course_status: CourseStatus | null }>(
    `SELECT course_status FROM syllabus_summary WHERE part = 'Part C'`
  );

  const notesRow = db.get<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM task_notes');
  const focusRow = db.get<{ total_min: number }>(
    'SELECT COALESCE(SUM(duration_minutes), 0) AS total_min FROM focus_sessions'
  );

  const totalRecords = Number(taskAgg?.total) || 0;
  const completed = Number(taskAgg?.completed) || 0;
  const inProgress = Number(taskAgg?.in_progress) || 0;
  const notStarted = Number(taskAgg?.not_started) || 0;
  const overdue = Number(taskAgg?.overdue) || 0;

  return {
    id: meta.id,
    label: profile?.name?.trim() ? profile.name.trim() : meta.label,
    username: meta.username,
    roll_number: profile?.roll_number?.trim() || meta.roll_number?.trim() || '',
    college: profile?.college?.trim() || '',
    total_records: totalRecords,
    completed,
    in_progress: inProgress,
    not_started: notStarted,
    overdue,
    completion_percentage: calculateCompletionPercentage(completed, totalRecords),
    part_a_completed: Number(taskAgg?.part_a_completed) || 0,
    part_a_total: Number(taskAgg?.part_a_total) || 0,
    part_b_completed: Number(taskAgg?.part_b_completed) || 0,
    part_b_total: Number(taskAgg?.part_b_total) || 0,
    part_c_status: partCRow?.course_status ?? 'Not Started',
    notes_count: Number(notesRow?.cnt) || 0,
    focus_minutes: Number(focusRow?.total_min) || 0,
    last_updated_at: taskAgg?.last_updated ?? null,
  };
}

export function getAdminAnalytics(primaryDb: SqliteDatabase): AdminAnalyticsResponse {
  const adminRow = ensureAdminSeed(primaryDb);
  const today = getLocalTodayYMD();

  const users = primaryDb.all<RawUserRow>(
    'SELECT * FROM users ORDER BY created_at DESC, id DESC'
  );

  const workspaces: AdminWorkspaceStat[] = [];

  // Registered Student Workspaces Only
  for (const u of users) {
    const uDb = getUserDb(u.db_filename, primaryDb);
    workspaces.push(
      collectWorkspaceStats(
        uDb,
        {
          id: String(u.id),
          label: u.display_name,
          username: u.username,
          roll_number: u.roll_number,
        },
        today
      )
    );
  }

  let totalRecords = 0;
  let completedRecords = 0;
  let inProgressRecords = 0;
  let notStartedRecords = 0;
  let overdueRecords = 0;
  let swayamCompletedCount = 0;
  let totalNotes = 0;
  let totalFocusMinutes = 0;

  for (const ws of workspaces) {
    totalRecords += ws.total_records;
    completedRecords += ws.completed;
    inProgressRecords += ws.in_progress;
    notStartedRecords += ws.not_started;
    overdueRecords += ws.overdue;
    if (ws.part_c_status === 'Completed') {
      swayamCompletedCount += 1;
    }
    totalNotes += ws.notes_count;
    totalFocusMinutes += ws.focus_minutes;
  }

  return {
    admin_username: adminRow.username,
    generated_at: new Date().toISOString(),
    totals: {
      total_workspaces: workspaces.length,
      registered_students: users.length,
      total_records: totalRecords,
      completed_records: completedRecords,
      in_progress_records: inProgressRecords,
      not_started_records: notStartedRecords,
      overdue_records: overdueRecords,
      completion_rate: calculateCompletionPercentage(completedRecords, totalRecords),
      swayam_completed_count: swayamCompletedCount,
      total_notes: totalNotes,
      total_focus_minutes: totalFocusMinutes,
    },
    workspaces,
  };
}

export function registerUser(
  primaryDb: SqliteDatabase,
  input: {
    username: string;
    display_name: string;
    roll_number?: string;
    password: string;
  }
): { user: AuthUser; token: string } {
  const cleanUsername = input.username.trim().toLowerCase();
  const cleanDisplayName = input.display_name.trim();
  const cleanRoll = (input.roll_number ?? '').trim();

  const adminRow = ensureAdminSeed(primaryDb);
  if (cleanUsername === adminRow.username.toLowerCase()) {
    throw new AppError(409, 'USERNAME_TAKEN', `Username "${cleanUsername}" is reserved.`, {
      username: 'This username is reserved.',
    });
  }

  const existing = primaryDb.get<{ id: number }>(
    'SELECT id FROM users WHERE LOWER(username) = LOWER(?)',
    cleanUsername
  );
  if (existing) {
    throw new AppError(409, 'USERNAME_TAKEN', `Username "${cleanUsername}" is already taken.`, {
      username: 'This username is already taken.',
    });
  }

  const saltHex = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(input.password, saltHex);
  const now = new Date().toISOString();
  const safeSlug = cleanUsername.replace(/[^a-z0-9_-]/g, '_');
  const dbFilename = `user_${safeSlug}_${crypto.randomBytes(4).toString('hex')}.sqlite`;

  const created = primaryDb.transaction(() => {
    const res = primaryDb.run(
      `INSERT INTO users (
         username, display_name, roll_number, password_hash, password_salt, db_filename, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      cleanUsername,
      cleanDisplayName,
      cleanRoll,
      passwordHash,
      saltHex,
      dbFilename,
      now,
      now
    );

    const row = primaryDb.get<RawUserRow>('SELECT * FROM users WHERE id = ?', res.lastInsertRowid)!;
    const token = createSessionToken(primaryDb, Number(row.id));
    return { user: toAuthUser(row), token };
  });

  // Initialize the user's isolated SQLite database with the 20 seeded B.Ed. Semester III records
  const userDb = getUserDb(created.user.db_filename, primaryDb);
  userDb.run(
    `UPDATE student_profile
     SET name = ?, roll_number = ?, updated_at = ?
     WHERE id = 1`,
    cleanDisplayName,
    cleanRoll,
    now
  );

  return created;
}

export function loginUser(
  primaryDb: SqliteDatabase,
  input: { username: string; password: string }
): { user: AuthUser; token: string } {
  const row = primaryDb.get<RawUserRow>(
    'SELECT * FROM users WHERE LOWER(username) = LOWER(?)',
    input.username.trim()
  );

  if (!row) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid username or password.');
  }

  const computedHash = hashPassword(input.password, row.password_salt);
  const expectedBuf = Buffer.from(row.password_hash, 'hex');
  const actualBuf = Buffer.from(computedHash, 'hex');

  if (
    expectedBuf.length !== actualBuf.length ||
    !crypto.timingSafeEqual(expectedBuf, actualBuf)
  ) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid username or password.');
  }

  // Ensure user's SQLite DB is initialized
  getUserDb(row.db_filename, primaryDb);

  const token = createSessionToken(primaryDb, Number(row.id));
  return { user: toAuthUser(row), token };
}

export function logoutSession(primaryDb: SqliteDatabase, token: string | null): void {
  if (!token) return;
  primaryDb.run('DELETE FROM user_sessions WHERE token = ?', token);
}

export function getUserFromSessionToken(
  primaryDb: SqliteDatabase,
  token: string | null
): AuthUser | null {
  if (!token) return null;
  const now = new Date().toISOString();
  const row = primaryDb.get<RawUserRow>(
    `SELECT u.*
     FROM user_sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > ?`,
    token,
    now
  );
  if (!row) return null;
  return toAuthUser(row);
}

export function getAuthSessionOverview(
  primaryDb: SqliteDatabase,
  token: string | null,
  adminToken: string | null = null
): AuthSessionResponse {
  const currentUser = getUserFromSessionToken(primaryDb, token);
  // Admin dashboard is strictly invisible to other student accounts
  const adminSession =
    currentUser === null ? getAdminFromSessionToken(primaryDb, adminToken) : null;

  return {
    authenticated: currentUser !== null,
    user: currentUser,
    admin_authenticated: adminSession !== null,
    admin_username: adminSession?.username ?? null,
  };
}

export function updateUserByAdmin(
  primaryDb: SqliteDatabase,
  userId: number,
  input: {
    username?: string;
    display_name?: string;
    roll_number?: string;
    college?: string;
    new_password?: string;
  }
): AdminWorkspaceStat {
  const row = primaryDb.get<RawUserRow>('SELECT * FROM users WHERE id = ?', userId);
  if (!row) {
    throw new AppError(404, 'USER_NOT_FOUND', `User #${userId} was not found.`);
  }

  const adminRow = ensureAdminSeed(primaryDb);
  const nextUsername =
    input.username !== undefined ? input.username.trim().toLowerCase() : row.username;
  const nextDisplayName =
    input.display_name !== undefined ? input.display_name.trim() : row.display_name;
  const nextRollNumber =
    input.roll_number !== undefined ? input.roll_number.trim() : row.roll_number;

  if (nextUsername === adminRow.username.toLowerCase()) {
    throw new AppError(409, 'USERNAME_TAKEN', `Username "${nextUsername}" is reserved.`, {
      username: 'This username is reserved.',
    });
  }

  const duplicate = primaryDb.get<{ id: number }>(
    'SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND id != ?',
    nextUsername,
    userId
  );
  if (duplicate) {
    throw new AppError(409, 'USERNAME_TAKEN', `Username "${nextUsername}" is already taken.`, {
      username: 'This username is already taken.',
    });
  }

  const now = new Date().toISOString();
  let nextSaltHex = row.password_salt;
  let nextPasswordHash = row.password_hash;

  if (input.new_password && input.new_password.trim().length > 0) {
    nextSaltHex = crypto.randomBytes(16).toString('hex');
    nextPasswordHash = hashPassword(input.new_password, nextSaltHex);
  }

  primaryDb.transaction(() => {
    primaryDb.run(
      `UPDATE users
       SET username = ?, display_name = ?, roll_number = ?, password_hash = ?, password_salt = ?, updated_at = ?
       WHERE id = ?`,
      nextUsername,
      nextDisplayName,
      nextRollNumber,
      nextPasswordHash,
      nextSaltHex,
      now,
      userId
    );
  });

  // Synchronize student_profile in the user's isolated SQLite database
  const userDb = getUserDb(row.db_filename, primaryDb);
  const currentProfile = userDb.get<{ college: string }>(
    'SELECT college FROM student_profile WHERE id = 1'
  );
  const nextCollege =
    input.college !== undefined ? input.college.trim() : (currentProfile?.college ?? '');

  userDb.run(
    `UPDATE student_profile
     SET name = ?, roll_number = ?, college = ?, updated_at = ?
     WHERE id = 1`,
    nextDisplayName,
    nextRollNumber,
    nextCollege,
    now
  );

  const today = getLocalTodayYMD();
  return collectWorkspaceStats(
    userDb,
    {
      id: String(userId),
      label: nextDisplayName,
      username: nextUsername,
      roll_number: nextRollNumber,
    },
    today
  );
}

export function deleteUserByAdmin(
  primaryDb: SqliteDatabase,
  userId: number
): { deleted: boolean; id: number; username: string } {
  const row = primaryDb.get<RawUserRow>('SELECT * FROM users WHERE id = ?', userId);
  if (!row) {
    throw new AppError(404, 'USER_NOT_FOUND', `User #${userId} was not found.`);
  }

  primaryDb.transaction(() => {
    primaryDb.run('DELETE FROM user_sessions WHERE user_id = ?', userId);
    primaryDb.run('DELETE FROM users WHERE id = ?', userId);
  });

  removeUserDb(row.db_filename, primaryDb);

  return {
    deleted: true,
    id: userId,
    username: row.username,
  };
}



