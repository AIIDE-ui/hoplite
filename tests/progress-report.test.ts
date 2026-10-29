import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProgressReport, getReportPartKey } from '../src/shared/progressReport.ts';
import type { ReportTaskInput } from '../src/shared/progressReport.ts';

function task(overrides: Partial<ReportTaskInput>): ReportTaskInput {
  return {
    id: 1,
    title: 'Record',
    status: 'Not Started',
    credits: 0.5,
    marks: 10,
    category_seed_key: 'part_a',
    due_date: null,
    completed_at: null,
    archived_at: null,
    subtask_total: 0,
    subtask_done: 0,
    time_spent_minutes: 0,
    ...overrides,
  };
}

test('getReportPartKey maps seeded parts and treats everything else as custom', () => {
  assert.equal(getReportPartKey('part_a'), 'part_a');
  assert.equal(getReportPartKey('part_c'), 'part_c');
  assert.equal(getReportPartKey(null), 'custom');
  assert.equal(getReportPartKey('my_category'), 'custom');
});

test('buildProgressReport totals, per-part rows, credits and finished ordering', () => {
  const report = buildProgressReport(
    [
      task({ id: 1, status: 'Completed', completed_at: '2026-08-10T10:00:00.000Z', subtask_total: 3, subtask_done: 3, time_spent_minutes: 90 }),
      task({ id: 2, status: 'Completed', completed_at: '2026-09-01T10:00:00.000Z', credits: 2, marks: 40 }),
      task({ id: 3, status: 'In Progress', due_date: '2026-09-01', subtask_total: 5, subtask_done: 2, time_spent_minutes: 30 }),
      task({ id: 4, status: 'Not Started', category_seed_key: 'part_b', credits: 1, marks: 20, due_date: '2026-12-01' }),
      task({ id: 5, status: 'Completed', category_seed_key: null, credits: 0, marks: 0, completed_at: '2026-07-01T10:00:00.000Z' }),
      // Archived records are excluded everywhere, matching the Dashboard.
      task({ id: 6, status: 'Completed', archived_at: '2026-09-02T00:00:00.000Z', credits: 5, marks: 100 }),
    ],
    '2026-10-01'
  );

  assert.equal(report.total, 5);
  assert.equal(report.completed, 3);
  assert.equal(report.in_progress, 1);
  assert.equal(report.not_started, 1);
  assert.equal(report.overdue, 1);
  assert.equal(report.completion_percentage, 60);
  assert.equal(report.credits_completed, 2.5);
  assert.equal(report.credits_total, 4);
  assert.equal(report.marks_completed, 50);
  assert.equal(report.marks_total, 80);
  assert.equal(report.subtasks_done, 5);
  assert.equal(report.subtasks_total, 8);
  assert.equal(report.time_spent_minutes, 120);
  assert.deepEqual(
    report.finished.map((t) => t.id),
    [2, 1, 5]
  );

  const partA = report.parts.find((p) => p.key === 'part_a');
  assert.ok(partA);
  assert.equal(partA.total, 3);
  assert.equal(partA.completed, 2);
  assert.equal(partA.completion_percentage, 67);
  assert.equal(partA.credits_completed, 2.5);
  assert.equal(report.parts.find((p) => p.key === 'part_c')?.total, 0);
  assert.equal(report.parts.find((p) => p.key === 'custom')?.completed, 1);
});

test('buildProgressReport handles an empty list without dividing by zero', () => {
  const report = buildProgressReport([], '2026-10-01');
  assert.equal(report.total, 0);
  assert.equal(report.completion_percentage, 0);
  assert.equal(report.finished.length, 0);
  assert.equal(report.parts.length, 4);
});
