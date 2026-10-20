import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { runMigrations } from './migrations.ts';
import { ensureInitialSeed } from './seed.ts';

function normalizeParam(val: unknown): SQLInputValue {
  if (val === undefined || val === null) return null;
  if (typeof val === 'boolean') return val ? 1 : 0;
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'bigint') {
    return val;
  }
  if (val instanceof Uint8Array) return val;
  return String(val);
}

function toPlainObject<T>(row: unknown): T {
  if (!row || typeof row !== 'object') return row as T;
  return { ...(row as Record<string, unknown>) } as T;
}

export class SqliteDatabase {
  public readonly raw: DatabaseSync;
  public readonly dbPath: string;
  private txDepth = 0;

  constructor(filePath: string) {
    this.dbPath = filePath;
    if (filePath !== ':memory:') {
      const dir = path.dirname(filePath);
      fs.mkdirSync(dir, { recursive: true });
    }
    this.raw = new DatabaseSync(filePath);
    this.raw.exec('PRAGMA foreign_keys = ON;');
    if (filePath !== ':memory:') {
      this.raw.exec('PRAGMA journal_mode = WAL;');
    }
    this.raw.exec('PRAGMA busy_timeout = 5000;');
  }

  exec(sql: string): void {
    this.raw.exec(sql);
  }

  get<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T | undefined {
    const stmt = this.raw.prepare(sql);
    const normalized = params.map(normalizeParam);
    const row = stmt.get(...normalized);
    if (row === undefined) return undefined;
    return toPlainObject<T>(row);
  }

  all<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T[] {
    const stmt = this.raw.prepare(sql);
    const normalized = params.map(normalizeParam);
    const rows = stmt.all(...normalized);
    return rows.map((r) => toPlainObject<T>(r));
  }

  run(sql: string, ...params: unknown[]): { lastInsertRowid: number; changes: number } {
    const stmt = this.raw.prepare(sql);
    const normalized = params.map(normalizeParam);
    const res = stmt.run(...normalized);
    return {
      lastInsertRowid: Number(res.lastInsertRowid),
      changes: Number(res.changes),
    };
  }

  transaction<T>(fn: () => T): T {
    if (this.txDepth === 0) {
      this.txDepth++;
      this.raw.exec('BEGIN IMMEDIATE;');
      try {
        const result = fn();
        this.raw.exec('COMMIT;');
        this.txDepth--;
        return result;
      } catch (err) {
        try {
          this.raw.exec('ROLLBACK;');
        } catch {
          // ignore rollback error
        }
        this.txDepth = 0;
        throw err;
      }
    } else {
      const spName = `sp_${this.txDepth}`;
      this.txDepth++;
      this.raw.exec(`SAVEPOINT ${spName};`);
      try {
        const result = fn();
        this.raw.exec(`RELEASE SAVEPOINT ${spName};`);
        this.txDepth--;
        return result;
      } catch (err) {
        try {
          this.raw.exec(`ROLLBACK TO SAVEPOINT ${spName};`);
          this.raw.exec(`RELEASE SAVEPOINT ${spName};`);
        } catch {
          // ignore
        }
        this.txDepth--;
        throw err;
      }
    }
  }

  close(): void {
    this.raw.close();
  }
}

let defaultDbInstance: SqliteDatabase | null = null;
const userDbCache = new Map<string, SqliteDatabase>();

export function resolveDataDir(): string {
  if (process.env.DATA_DIR && process.env.DATA_DIR.trim()) {
    const customDir = process.env.DATA_DIR.trim();
    return path.isAbsolute(customDir) ? customDir : path.resolve(process.cwd(), customDir);
  }
  const defaultDir = path.resolve(process.cwd(), 'data');
  try {
    fs.mkdirSync(defaultDir, { recursive: true });
    fs.accessSync(defaultDir, fs.constants.W_OK);
    return defaultDir;
  } catch {
    const fallbackDir = path.join('/tmp', 'semester3-data');
    fs.mkdirSync(fallbackDir, { recursive: true });
    return fallbackDir;
  }
}

export function resolveDefaultDbPath(): string {
  return path.join(resolveDataDir(), 'bed-tracker.sqlite');
}

export function initializeDatabase(filePath?: string): SqliteDatabase {
  const targetPath = filePath ?? resolveDefaultDbPath();
  const db = new SqliteDatabase(targetPath);
  runMigrations(db);
  ensureInitialSeed(db);
  return db;
}

export function getDb(): SqliteDatabase {
  if (!defaultDbInstance) {
    defaultDbInstance = initializeDatabase();
  }
  return defaultDbInstance;
}

export function getUserDb(dbFilename: string, primaryDb?: SqliteDatabase): SqliteDatabase {
  const safeName = path.basename(dbFilename);
  const existing = userDbCache.get(safeName);
  if (existing) {
    return existing;
  }

  const baseDb = primaryDb ?? getDb();
  const targetPath =
    baseDb.dbPath === ':memory:'
      ? ':memory:'
      : path.join(resolveDataDir(), 'users', safeName);

  const userDb = initializeDatabase(targetPath);
  userDbCache.set(safeName, userDb);
  return userDb;
}

export function removeUserDb(dbFilename: string, primaryDb?: SqliteDatabase): void {
  const safeName = path.basename(dbFilename);
  const existing = userDbCache.get(safeName);
  if (existing) {
    try {
      existing.close();
    } catch {
      // ignore close error
    }
    userDbCache.delete(safeName);
  }

  const baseDb = primaryDb ?? getDb();
  if (baseDb.dbPath !== ':memory:') {
    const targetPath = path.join(resolveDataDir(), 'users', safeName);
    for (const suffix of ['', '-wal', '-shm']) {
      try {
        fs.rmSync(`${targetPath}${suffix}`, { force: true });
      } catch {
        // ignore file removal error
      }
    }
  }
}

export function closeAllUserDbs(): void {
  for (const db of userDbCache.values()) {
    try {
      db.close();
    } catch {
      // ignore close error
    }
  }
  userDbCache.clear();
}

export function setDbForTesting(db: SqliteDatabase | null): void {
  closeAllUserDbs();
  defaultDbInstance = db;
}


