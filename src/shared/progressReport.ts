import type { TaskStatus } from './constants.ts';
import { calculateCompletionPercentage, isTaskOverdue } from './stats.ts';

export type ReportPartKey = 'part_a' | 'part_b' | 'part_c' | 'custom';

export const REPORT_PART_LABELS: Record<ReportPartKey, string> = {
  part_a: 'Part A — Practical Records',
  part_b: 'Part B — EPC Records',
  part_c: 'Part C — Online Course (SWAYAM)',
  custom: 'Custom Records',
};

export interface ReportTaskInput {
  id: number;
  title: string;
  status: TaskStatus;
  credits: number;
  marks: number;
  category_seed_key?: string | null;
  due_date: string | null;
  completed_at: string | null;
  archived_at: string | null;
  subtask_total: number;
  subtask_done: number;
  time_spent_minutes: number;
}

export interface ReportPartRow {
  key: ReportPartKey;
  label: string;
  total: number;
  completed: number;
  in_progress: number;
  not_started: number;
  completion_percentage: number;
  credits_completed: number;
  credits_total: number;
  marks_completed: number;
  marks_total: number;
}

export interface ProgressReport<T extends ReportTaskInput = ReportTaskInput> {
  total: number;
  completed: number;
  in_progress: number;
  not_started: number;
  overdue: number;
  completion_percentage: number;
  credits_completed: number;
  credits_total: number;
  marks_completed: number;
  marks_total: number;
  subtasks_done: number;
  subtasks_total: number;
  time_spent_minutes: number;
  parts: ReportPartRow[];
  /** Completed records, most recently finished first. */
  finished: T[];
}

export function getReportPartKey(seedKey: string | null | undefined): ReportPartKey {
  if (seedKey === 'part_a' || seedKey === 'part_b' || seedKey === 'part_c') return seedKey;
  return 'custom';
}

// Avoids float noise from summing 0.5-credit records (e.g. 3.5000000001).
function roundTo2(n: number): number {
  return Math.round(n * 100) / 100;
}

function emptyPart(key: ReportPartKey): ReportPartRow {
  return {
    key,
    label: REPORT_PART_LABELS[key],
    total: 0,
    completed: 0,
    in_progress: 0,
    not_started: 0,
    completion_percentage: 0,
    credits_completed: 0,
    credits_total: 0,
    marks_completed: 0,
    marks_total: 0,
  };
}

/**
 * Same record set as the Dashboard (all non-archived records), so the
 * completion percentage matches the Dashboard's overall figure.
 */
export function buildProgressReport<T extends ReportTaskInput>(
  tasks: T[],
  today: string
): ProgressReport<T> {
  const active = tasks.filter((t) => !t.archived_at);
  const parts: Record<ReportPartKey, ReportPartRow> = {
    part_a: emptyPart('part_a'),
    part_b: emptyPart('part_b'),
    part_c: emptyPart('part_c'),
    custom: emptyPart('custom'),
  };

  let overdue = 0;
  let subtasks_done = 0;
  let subtasks_total = 0;
  let time_spent_minutes = 0;

  for (const t of active) {
    const row = parts[getReportPartKey(t.category_seed_key)];
    const credits = Number(t.credits) || 0;
    const marks = Number(t.marks) || 0;
    row.total++;
    row.credits_total += credits;
    row.marks_total += marks;
    if (t.status === 'Completed') {
      row.completed++;
      row.credits_completed += credits;
      row.marks_completed += marks;
    } else if (t.status === 'In Progress') {
      row.in_progress++;
    } else {
      row.not_started++;
    }
    if (isTaskOverdue(t.due_date, t.status, today)) overdue++;
    subtasks_done += Number(t.subtask_done) || 0;
    subtasks_total += Number(t.subtask_total) || 0;
    time_spent_minutes += Number(t.time_spent_minutes) || 0;
  }

  const rows = (Object.keys(parts) as ReportPartKey[]).map((key) => {
    const r = parts[key];
    return {
      ...r,
      completion_percentage: calculateCompletionPercentage(r.completed, r.total),
      credits_completed: roundTo2(r.credits_completed),
      credits_total: roundTo2(r.credits_total),
      marks_completed: roundTo2(r.marks_completed),
      marks_total: roundTo2(r.marks_total),
    };
  });

  const sum = (pick: (r: ReportPartRow) => number) =>
    roundTo2(rows.reduce((acc, r) => acc + pick(r), 0));
  const completed = sum((r) => r.completed);

  const finished = active
    .filter((t) => t.status === 'Completed')
    .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''));

  return {
    total: active.length,
    completed,
    in_progress: sum((r) => r.in_progress),
    not_started: sum((r) => r.not_started),
    overdue,
    completion_percentage: calculateCompletionPercentage(completed, active.length),
    credits_completed: sum((r) => r.credits_completed),
    credits_total: sum((r) => r.credits_total),
    marks_completed: sum((r) => r.marks_completed),
    marks_total: sum((r) => r.marks_total),
    subtasks_done,
    subtasks_total,
    time_spent_minutes,
    parts: rows,
    finished,
  };
}
