import fs from 'node:fs';
import { initializeDatabase, resolveDefaultDbPath } from '../server/db/connection.ts';

const args = process.argv.slice(2);
if (!args.includes('--yes')) {
  console.error(
    'Refusing to reset database without confirmation flag.\nRun with: npm run db:reset -- --yes'
  );
  process.exit(1);
}

const dbPath = resolveDefaultDbPath();
for (const suffix of ['', '-wal', '-shm']) {
  const target = `${dbPath}${suffix}`;
  if (fs.existsSync(target)) {
    fs.unlinkSync(target);
  }
}

const db = initializeDatabase(dbPath);
db.close();
console.log(`Database reset and re-seeded at: ${dbPath}`);
