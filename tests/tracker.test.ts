import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCompletionPercentage,
  calculateTimeSpentMinutes,
  computeTaskStatistics,
  formatPartAPlanningNote,
  formatPlainDate,
  isTaskOverdue,
  shouldSuggestTaskCompletion,
} from '../src/shared/stats.ts';
import { initializeDatabase } from '../server/db/connection.ts';
import { executeRestoreSyllabus, previewRestoreSyllabus } from '../server/db/seed.ts';
import {
  createCategory,
  createFocusSession,
  createNote,
  createSubtask,
  createTask,
  deleteCategory,
  getDashboardSummary,
  getSyllabusOverview,
  getTaskDetailById,
  listCategories,
  listTasks,
  permanentDeleteTask,
  softDeleteTask,
  updateSubtask,
  updateSyllabusPart,
  updateTask,
} from '../server/services/trackerService.ts';
import { AppError } from '../server/errors.ts';

test('pure statistics and date helpers', () => {
  assert.equal(calculateCompletionPercentage(0, 0), 0);
  assert.equal(calculateCompletionPercentage(0, 20), 0);
  assert.equal(calculateCompletionPercentage(5, 20), 25);
  assert.equal(calculateCompletionPercentage(1, 3), 33);

  assert.equal(isTaskOverdue('2026-10-10', 'Not Started', '2026-10-19'), true);
  assert.equal(isTaskOverdue('2026-10-10', 'Completed', '2026-10-19'), false);
  assert.equal(isTaskOverdue('2026-10-19', 'In Progress', '2026-10-19'), false);
  assert.equal(isTaskOverdue(null, 'Not Started', '2026-10-19'), false);

  assert.equal(calculateTimeSpentMinutes([25, 30], 10), 65);
  assert.equal(calculateTimeSpentMinutes([20], -30), 0);

  assert.equal(shouldSuggestTaskCompletion('Not Started', []), false);
  assert.equal(
    shouldSuggestTaskCompletion('In Progress', [{ done: true }, { done: false }]),
    false
  );
  assert.equal(
    shouldSuggestTaskCompletion('In Progress', [{ done: true }, { done: true }]),
    true
  );
  assert.equal(
    shouldSuggestTaskCompletion('Completed', [{ done: true }, { done: true }]),
    false
  );

  assert.equal(formatPlainDate('2026-10-19', 'DD/MM/YYYY'), '19/10/2026');
  assert.equal(formatPlainDate('2026-10-19', 'MM/DD/YYYY'), '10/19/2026');
  assert.equal(formatPlainDate('2026-10-19', 'YYYY-MM-DD'), '2026-10-19');

  const note = formatPartAPlanningNote(20, 400, 16, 12, 240);
  assert.equal(
    note,
    'The official Part A total (20 credits / 400 marks) is larger than the planning split of the 16 tracked Part A tasks (12 / 240). The difference is not allocated to any tracked record.'
  );
});

test('SQLite initialization, seeding, and syllabus totals', () => {
  const db = initializeDatabase(':memory:');
  const categories = listCategories(db);
  assert.equal(categories.length, 3);

  const tasksRes = listTasks(db, { pageSize: 50 });
  assert.equal(tasksRes.total, 20);
  assert.equal(tasksRes.items[0].title, 'Observation Record — Level I');
  assert.equal(tasksRes.items[1].title, 'Observation Record — Level II');
  assert.equal(tasksRes.items[19].title, 'Understanding the Self');

  const summary = getDashboardSummary(db, '2026-10-19');
  assert.equal(summary.total, 20);
  assert.equal(summary.completed, 0);
  assert.equal(summary.pending, 20);
  assert.equal(summary.in_progress, 0);
  assert.equal(summary.completion_percentage, 0);
  assert.equal(summary.by_difficulty.Hard, 2);
  assert.equal(summary.by_difficulty.Easy, 2);
  assert.equal(summary.by_difficulty.Medium, 16);

  const partA = summary.syllabus.parts.find((p) => p.part === 'Part A')!;
  const partB = summary.syllabus.parts.find((p) => p.part === 'Part B')!;
  const partC = summary.syllabus.parts.find((p) => p.part === 'Part C')!;

  assert.equal(partA.official_credits, 20);
  assert.equal(partA.official_marks, 400);
  assert.equal(partA.tracked_task_count, 16);
  assert.equal(partA.planning_credits_sum, 14);
  assert.equal(partA.planning_marks_sum, 280);

  assert.equal(partB.official_credits, 4);
  assert.equal(partB.official_marks, 80);
  assert.equal(partB.tracked_task_count, 4);
  assert.equal(partB.planning_credits_sum, 4);
  assert.equal(partB.planning_marks_sum, 80);

  assert.equal(partC.official_credits, 1);
  assert.equal(partC.official_marks, 20);
  assert.equal(partC.tracked_task_count, 0);
  assert.equal(partC.course_status, 'Not Started');

  db.close();
});

test('task status independence, subtasks suggestion, focus sessions, and Part C course status', () => {
  const db = initializeDatabase(':memory:');
  const tasks = listTasks(db, { pageSize: 50 }).items;
  const obs1 = tasks[0];
  const obs2 = tasks[1];

  // Completing Level I leaves Level II unchanged
  const updated1 = updateTask(db, obs1.id, { status: 'Completed' });
  assert.equal(updated1.status, 'Completed');
  assert.ok(updated1.completed_at);

  const reloaded2 = getTaskDetailById(db, obs2.id);
  assert.equal(reloaded2.status, 'Not Started');
  assert.equal(reloaded2.completed_at, null);

  // Moving away from Completed clears completed_at
  const reopened1 = updateTask(db, obs1.id, { status: 'In Progress' });
  assert.equal(reopened1.status, 'In Progress');
  assert.equal(reopened1.completed_at, null);

  // Subtasks checklist suggestion without auto-complete
  const st1 = createSubtask(db, obs1.id, { title: 'Draft observation sheets' });
  assert.equal(st1.suggest_complete, false);
  const st2 = updateSubtask(db, st1.subtask.id, { done: true });
  assert.equal(st2.suggest_complete, true);
  assert.equal(getTaskDetailById(db, obs1.id).status, 'In Progress');

  // Time spent = sum(focus_sessions) + manual_minutes_adjustment
  createFocusSession(db, { task_id: obs1.id, duration_minutes: 40, notes: 'Morning session' });
  const withAdj = updateTask(db, obs1.id, { manual_minutes_adjustment: 15 });
  assert.equal(withAdj.focus_minutes_sum, 40);
  assert.equal(withAdj.time_spent_minutes, 55);

  // Part C course status never affects completion %
  updateSyllabusPart(db, 'Part C', { course_status: 'Completed' });
  const sumAfterCourse = getDashboardSummary(db, '2026-10-19');
  assert.equal(sumAfterCourse.completed, 0);
  assert.equal(sumAfterCourse.completion_percentage, 0);
  assert.equal(
    sumAfterCourse.syllabus.parts.find((p) => p.part === 'Part C')?.course_status,
    'Completed'
  );

  // Editing official totals without confirm:true fails with 400
  assert.throws(
    () => updateSyllabusPart(db, 'Part A', { official_credits: 22 }),
    (err: unknown) => err instanceof AppError && err.statusCode === 400
  );

  db.close();
});

test('soft delete, permanent delete cascading, category conflict 409, and restore original syllabus', () => {
  const db = initializeDatabase(':memory:');
  const tasks = listTasks(db, { pageSize: 50 }).items;
  const target = tasks[0]; // Observation Record — Level I
  const second = tasks[1]; // Observation Record — Level II

  // Edit second task title so we can verify restore-syllabus never overwrites existing edits
  updateTask(db, second.id, { title: 'Observation Record — Level II (Edited)' });

  // Add subtask, note, and focus session to target
  createSubtask(db, target.id, { title: 'Step 1' });
  createNote(db, { task_id: target.id, title: 'Note 1', content: 'Record note' });
  createFocusSession(db, { task_id: target.id, duration_minutes: 25 });

  // Soft delete target
  softDeleteTask(db, target.id);
  assert.equal( getDashboardSummary(db, '2026-10-19').total, 19);

  // Soft delete second task too
  softDeleteTask(db, second.id);
  assert.equal(getDashboardSummary(db, '2026-10-19').total, 18);

  // Permanent delete target
  permanentDeleteTask(db, target.id);

  // Subtasks and notes for target are cascaded away, while focus_sessions and task_activity keep rows with task_id = NULL
  const remainingSubtasks = db.all('SELECT * FROM subtasks WHERE task_id = ?', target.id);
  assert.equal(remainingSubtasks.length, 0);
  const preservedFocus = db.all<{ task_id: number | null; task_title: string }>(
    'SELECT task_id, task_title FROM focus_sessions'
  );
  assert.equal(preservedFocus.length, 1);
  assert.equal(preservedFocus[0].task_id, null);
  assert.equal(preservedFocus[0].task_title, 'Observation Record — Level I');

  // Preview restore syllabus should list 1 missing task (target) and 1 archived task (second)
  const preview = previewRestoreSyllabus(db);
  assert.equal(preview.missing_tasks.length, 1);
  assert.equal(preview.archived_tasks.length, 1);

  // Execute restore syllabus
  const restoreRes = executeRestoreSyllabus(db);
  assert.equal(restoreRes.restored_missing_tasks, 1);
  assert.equal(restoreRes.unarchived_tasks, 1);

  const afterRestore = listTasks(db, { pageSize: 50 });
  assert.equal(afterRestore.total, 20);
  const restoredSecond = afterRestore.items.find((t) => t.id === second.id)!;
  assert.equal(restoredSecond.title, 'Observation Record — Level II (Edited)');

  // Category deletion rules
  const seededCat = listCategories(db).find((c) => c.seed_key === 'part_a')!;
  assert.throws(
    () => deleteCategory(db, seededCat.id),
    (err: unknown) => err instanceof AppError && err.statusCode === 409
  );

  const customCat = createCategory(db, { name: 'Internship Prep' });
  const customTask = createTask(db, {
    title: 'Prepare chart work',
    category_id: customCat.id,
  });

  // Deleting custom category with non-archived task returns 409
  assert.throws(
    () => deleteCategory(db, customCat.id),
    (err: unknown) => err instanceof AppError && err.statusCode === 409
  );

  // Archive custom task, then deleting custom category succeeds
  softDeleteTask(db, customTask.id);
  const delCatRes = deleteCategory(db, customCat.id);
  assert.equal(delCatRes.deleted, true);

  db.close();
});

test('HTTP API security middleware and JSON 404 on unknown /api routes', async () => {
  const { setDbForTesting } = await import('../server/db/connection.ts');
  const { createApp } = await import('../server/app.ts');
  const http = await import('node:http');

  const memDb = initializeDatabase(':memory:');
  setDbForTesting(memDb);

  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    // 1. Unknown /api route returns JSON 404
    const res404 = await fetch(`${baseUrl}/api/does-not-exist`);
    assert.equal(res404.status, 404);
    const body404 = (await res404.json()) as { error: { code: string } };
    assert.equal(body404.error.code, 'NOT_FOUND');

    // 2. Write without Content-Type: application/json returns 400
    const resNoJson = await fetch(`${baseUrl}/api/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/plain' },
      body: 'invalid',
    });
    assert.equal(resNoJson.status, 400);

    // 3. Write with mismatched Origin header returns 403
    const resBadOrigin = await fetch(`${baseUrl}/api/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://malicious.example.com',
      },
      body: JSON.stringify({ name: 'Test' }),
    });
    assert.equal(resBadOrigin.status, 403);

    // 4. Write with matching Origin and Content-Type succeeds
    const resGood = await fetch(`${baseUrl}/api/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Origin: baseUrl,
      },
      body: JSON.stringify({
        name: 'Anitha R.',
        roll_number: '25BED104',
        university: 'TNTEU',
        programme: 'B.Ed.',
        semester: 3,
        syllabus_pattern: 'CBCS 2021–2022',
        academic_year: '2025–2027',
        college: 'Govt College of Education',
        teaching_subject: 'Mathematics',
      }),
    });
    assert.equal(resGood.status, 200);
    const bodyGood = (await resGood.json()) as { data: { name: string } };
    assert.equal(bodyGood.data.name, 'Anitha R.');

    // 5. Partial task updates via PUT /api/tasks/:id preserve Due Date when Status changes and preserve Status when Due Date changes
    const setDueRes = await fetch(`${baseUrl}/api/tasks/1`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Origin: baseUrl,
      },
      body: JSON.stringify({
        status: 'In Progress',
        due_date: '2026-11-15',
        start_date: '2026-10-20',
        priority: 'High',
        notes: 'Submitted to guide teacher',
      }),
    });
    assert.equal(setDueRes.status, 200);
    const setDueBody = (await setDueRes.json()) as {
      data: {
        status: string;
        due_date: string | null;
        start_date: string | null;
        priority: string;
        level: string;
        notes: string;
      };
    };
    assert.equal(setDueBody.data.status, 'In Progress');
    assert.equal(setDueBody.data.due_date, '2026-11-15');
    assert.equal(setDueBody.data.level, 'Level I');

    // Now change ONLY Status (e.g. inline status dropdown or Complete button) -> Due Date and other fields MUST stay
    const changeStatusRes = await fetch(`${baseUrl}/api/tasks/1`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Origin: baseUrl,
      },
      body: JSON.stringify({ status: 'Completed' }),
    });
    assert.equal(changeStatusRes.status, 200);
    const changeStatusBody = (await changeStatusRes.json()) as {
      data: {
        status: string;
        due_date: string | null;
        start_date: string | null;
        priority: string;
        level: string;
        notes: string;
      };
    };
    assert.equal(changeStatusBody.data.status, 'Completed');
    assert.equal(changeStatusBody.data.due_date, '2026-11-15');
    assert.equal(changeStatusBody.data.start_date, '2026-10-20');
    assert.equal(changeStatusBody.data.priority, 'High');
    assert.equal(changeStatusBody.data.level, 'Level I');
    assert.equal(changeStatusBody.data.notes, 'Submitted to guide teacher');

    // Now change ONLY Due Date -> Status ('Completed') MUST stay
    const changeDueOnlyRes = await fetch(`${baseUrl}/api/tasks/1`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Origin: baseUrl,
      },
      body: JSON.stringify({ due_date: '2026-11-20' }),
    });
    assert.equal(changeDueOnlyRes.status, 200);
    const changeDueOnlyBody = (await changeDueOnlyRes.json()) as {
      data: {
        status: string;
        due_date: string | null;
      };
    };
    assert.equal(changeDueOnlyBody.data.status, 'Completed');
    assert.equal(changeDueOnlyBody.data.due_date, '2026-11-20');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    setDbForTesting(null);
    memDb.close();
  }
});

test('Multi-user SQLite workspace isolation & backup JSON import/export', async () => {
  const { createApp } = await import('../server/app.ts');
  const { setDbForTesting } = await import('../server/db/connection.ts');
  const http = await import('node:http');

  const memDb = initializeDatabase(':memory:');
  setDbForTesting(memDb);

  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    // 1. Register Student A
    const regARes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: baseUrl },
      body: JSON.stringify({
        username: 'student_a',
        display_name: 'Karthik S.',
        roll_number: '25BED001',
        password: 'password123',
      }),
    });
    assert.equal(regARes.status, 201);
    const cookieA = regARes.headers.get('set-cookie')?.split(';')[0] ?? '';
    assert.ok(cookieA.startsWith('bed_session='));

    // 2. Register Friend B
    const regBRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: baseUrl },
      body: JSON.stringify({
        username: 'friend_b',
        display_name: 'Priya R.',
        roll_number: '25BED002',
        password: 'password456',
      }),
    });
    assert.equal(regBRes.status, 201);
    const cookieB = regBRes.headers.get('set-cookie')?.split(';')[0] ?? '';
    assert.ok(cookieB.startsWith('bed_session='));

    // Verify /api/auth/session keeps accounts private (no public users list returned)
    const sessionCheckRes = await fetch(`${baseUrl}/api/auth/session`);
    const sessionCheck = (await sessionCheckRes.json()) as {
      data: Record<string, unknown>;
    };
    assert.equal(sessionCheck.data.authenticated, false);
    assert.equal(sessionCheck.data.user, null);
    assert.equal('users' in sessionCheck.data, false);

    // 3. Student A completes task #1 and adds a custom task in their isolated SQLite DB
    const updateTaskARes = await fetch(`${baseUrl}/api/tasks/1`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Origin: baseUrl,
        Cookie: cookieA,
      },
      body: JSON.stringify({ status: 'Completed' }),
    });
    assert.equal(updateTaskARes.status, 200);

    const sumARes = await fetch(`${baseUrl}/api/dashboard/summary`, {
      headers: { Cookie: cookieA },
    });
    const sumA = (await sumARes.json()) as { data: { completed: number; total: number } };
    assert.equal(sumA.data.completed, 1);
    assert.equal(sumA.data.total, 20);

    // 4. Friend B's isolated SQLite DB still has 0 completed tasks
    const sumBRes = await fetch(`${baseUrl}/api/dashboard/summary`, {
      headers: { Cookie: cookieB },
    });
    const sumB = (await sumBRes.json()) as { data: { completed: number; total: number } };
    assert.equal(sumB.data.completed, 0);
    assert.equal(sumB.data.total, 20);

    // 5. Default (unauthenticated) workspace also still has 0 completed tasks
    const sumDefaultRes = await fetch(`${baseUrl}/api/dashboard/summary`);
    const sumDefault = (await sumDefaultRes.json()) as {
      data: { completed: number; total: number };
    };
    assert.equal(sumDefault.data.completed, 0);

    // 6. Export Student A's backup JSON and import it into Friend B's workspace
    const backupARes = await fetch(`${baseUrl}/api/backup/json`, {
      headers: { Cookie: cookieA },
    });
    assert.equal(backupARes.status, 200);
    const backupAData = (await backupARes.json()) as { data: Record<string, unknown> };

    const importBRes = await fetch(`${baseUrl}/api/backup/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: baseUrl,
        Cookie: cookieB,
      },
      body: JSON.stringify({
        confirm: true,
        backup: backupAData.data,
      }),
    });
    assert.equal(importBRes.status, 200);

    const sumBAfterImportRes = await fetch(`${baseUrl}/api/dashboard/summary`, {
      headers: { Cookie: cookieB },
    });
    const sumBAfterImport = (await sumBAfterImportRes.json()) as {
      data: { completed: number; total: number };
    };
    assert.equal(sumBAfterImport.data.completed, 1);

    // 7. Unauthenticated requests get 401 and student accounts get 403 Forbidden from /api/admin/analytics
    const unauthAdminRes = await fetch(`${baseUrl}/api/admin/analytics`);
    assert.equal(unauthAdminRes.status, 401);

    const studentAdminRes = await fetch(`${baseUrl}/api/admin/analytics`, {
      headers: { Cookie: cookieA },
    });
    assert.equal(studentAdminRes.status, 403);

    // 8. Separate Admin login succeeds and returns simple analytics across all SQLite workspaces
    const expectedAdminUser = (process.env.ADMIN_USERNAME || 'admin').trim();
    const expectedAdminPass = (process.env.ADMIN_PASSWORD || 'admin123').trim();
    const adminLoginRes = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: baseUrl },
      body: JSON.stringify({ username: expectedAdminUser, password: expectedAdminPass }),
    });
    assert.equal(adminLoginRes.status, 200);
    const adminCookie = adminLoginRes.headers.get('set-cookie') || '';
    assert.ok(adminCookie.includes('bed_admin_session='));

    const analyticsRes = await fetch(`${baseUrl}/api/admin/analytics`, {
      headers: { Cookie: adminCookie },
    });
    assert.equal(analyticsRes.status, 200);
    const analyticsBody = (await analyticsRes.json()) as {
      data: {
        totals: {
          total_workspaces: number;
          registered_students: number;
          total_records: number;
          completed_records: number;
          completion_rate: number;
        };
        workspaces: Array<{
          id: string;
          label: string;
          username: string;
          roll_number: string;
          completed: number;
        }>;
      };
    };
    assert.equal(analyticsBody.data.totals.total_workspaces, 2);
    assert.equal(analyticsBody.data.totals.registered_students, 2);
    assert.ok(analyticsBody.data.totals.completed_records >= 2);
    assert.equal(
      analyticsBody.data.workspaces.some((w) => w.username === 'local'),
      false
    );

    // 9. Admin can modify a registered student entry (PUT /api/admin/users/:id)
    const targetWs = analyticsBody.data.workspaces.find((w) => w.username === 'friend_b')!;
    assert.ok(targetWs);
    const editUserRes = await fetch(`${baseUrl}/api/admin/users/${targetWs.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Origin: baseUrl,
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        display_name: 'Anitha M. (Corrected)',
        username: 'anitha_m',
        roll_number: '23BED205',
        college: 'Govt College of Education',
      }),
    });
    assert.equal(editUserRes.status, 200);
    const editUserBody = (await editUserRes.json()) as {
      data: { label: string; username: string; roll_number: string; college: string };
    };
    assert.equal(editUserBody.data.label, 'Anitha M. (Corrected)');
    assert.equal(editUserBody.data.username, 'anitha_m');
    assert.equal(editUserBody.data.roll_number, '23BED205');
    assert.equal(editUserBody.data.college, 'Govt College of Education');

    // 10. Student session cannot delete user entries (403 Forbidden), Admin can delete (DELETE /api/admin/users/:id)
    const studentDeleteAttempt = await fetch(`${baseUrl}/api/admin/users/${targetWs.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Origin: baseUrl,
        Cookie: cookieA,
      },
      body: JSON.stringify({}),
    });
    assert.equal(studentDeleteAttempt.status, 403);

    const deleteUserRes = await fetch(`${baseUrl}/api/admin/users/${targetWs.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Origin: baseUrl,
        Cookie: adminCookie,
      },
      body: JSON.stringify({}),
    });
    assert.equal(deleteUserRes.status, 200);
    const deleteUserBody = (await deleteUserRes.json()) as {
      data: { deleted: boolean; id: number; username: string };
    };
    assert.equal(deleteUserBody.data.deleted, true);
    assert.equal(deleteUserBody.data.username, 'anitha_m');

    const analyticsAfterDeleteRes = await fetch(`${baseUrl}/api/admin/analytics`, {
      headers: { Cookie: adminCookie },
    });
    const analyticsAfterDelete = (await analyticsAfterDeleteRes.json()) as {
      data: {
        totals: { total_workspaces: number; registered_students: number };
        workspaces: Array<{ username: string }>;
      };
    };
    assert.equal(analyticsAfterDelete.data.totals.total_workspaces, 1);
    assert.equal(analyticsAfterDelete.data.totals.registered_students, 1);
    assert.equal(
      analyticsAfterDelete.data.workspaces.some((w) => w.username === 'anitha_m'),
      false
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    setDbForTesting(null);
    memDb.close();
  }
});


