import type { CourseStatus, TaskLevel, TaskStatus } from './constants.ts';

export type AchievementId =
  | 'first_record'
  | 'five_records'
  | 'halfway'
  | 'level_1'
  | 'level_2'
  | 'part_a'
  | 'part_b'
  | 'swayam'
  | 'steps_25'
  | 'planner'
  | 'focused'
  | 'semester_star';

export interface AchievementTaskInput {
  status: TaskStatus;
  level: TaskLevel;
  category_seed_key?: string | null;
  due_date: string | null;
  completed_at: string | null;
  archived_at: string | null;
  subtask_done: number;
  time_spent_minutes: number;
}

export interface Achievement {
  id: AchievementId;
  title: string;
  description: string;
  hint: string;
  earned: boolean;
  current: number;
  target: number;
  /** ISO timestamp when known (record-based badges only). */
  earned_at: string | null;
}

const DUE_DATES_TARGET = 10;
const STEPS_TARGET = 25;
const FOCUS_MINUTES_TARGET = 600;

function completedTimes(tasks: AchievementTaskInput[]): string[] {
  return tasks
    .filter((t) => t.status === 'Completed' && t.completed_at)
    .map((t) => t.completed_at as string)
    .sort();
}

// "All records in a group" badges: earned only when the group is non-empty.
function groupBadge(group: AchievementTaskInput[]) {
  const done = group.filter((t) => t.status === 'Completed');
  const earned = group.length > 0 && done.length === group.length;
  const times = completedTimes(group);
  return {
    current: done.length,
    target: group.length,
    earned,
    earned_at: earned && times.length === group.length ? times[times.length - 1] : null,
  };
}

function nthTime(tasks: AchievementTaskInput[], n: number): string | null {
  const times = completedTimes(tasks);
  return times.length >= n ? times[n - 1] : null;
}

/**
 * Badges are derived from current data (nothing is stored), so a badge is
 * lost again if, for example, a record is moved back to In Progress.
 */
export function computeAchievements(
  tasks: AchievementTaskInput[],
  swayamStatus: CourseStatus | null
): Achievement[] {
  const active = tasks.filter((t) => !t.archived_at);
  const completed = active.filter((t) => t.status === 'Completed').length;
  const partA = active.filter((t) => t.category_seed_key === 'part_a');
  const partB = active.filter((t) => t.category_seed_key === 'part_b');
  const level1 = partA.filter((t) => t.level === 'Level I');
  const level2 = partA.filter((t) => t.level === 'Level II');
  const stepsDone = active.reduce((acc, t) => acc + (Number(t.subtask_done) || 0), 0);
  const withDue = active.filter((t) => t.due_date).length;
  const minutes = active.reduce((acc, t) => acc + (Number(t.time_spent_minutes) || 0), 0);
  const halfTarget = Math.max(1, Math.ceil(active.length / 2));
  const swayamDone = swayamStatus === 'Completed';

  const a = groupBadge(partA);
  const b = groupBadge(partB);
  const l1 = groupBadge(level1);
  const l2 = groupBadge(level2);
  const allDone = active.length > 0 && completed === active.length;

  const list: Achievement[] = [
    {
      id: 'first_record',
      title: 'First Step',
      description: 'Completed your first record.',
      hint: 'Mark any record as Completed.',
      current: Math.min(completed, 1),
      target: 1,
      earned: completed >= 1,
      earned_at: nthTime(active, 1),
    },
    {
      id: 'five_records',
      title: 'On a Roll',
      description: 'Completed 5 records.',
      hint: 'Complete 5 records in total.',
      current: Math.min(completed, 5),
      target: 5,
      earned: completed >= 5,
      earned_at: nthTime(active, 5),
    },
    {
      id: 'halfway',
      title: 'Halfway There',
      description: 'Completed half of your records.',
      hint: `Complete ${halfTarget} of your ${active.length} records.`,
      current: Math.min(completed, halfTarget),
      target: halfTarget,
      earned: active.length > 0 && completed >= halfTarget,
      earned_at: active.length > 0 ? nthTime(active, halfTarget) : null,
    },
    {
      id: 'level_1',
      title: 'Level I Complete',
      description: 'Finished every Part A Level I record.',
      hint: 'Complete all Level I records in Part A.',
      ...l1,
    },
    {
      id: 'level_2',
      title: 'Level II Complete',
      description: 'Finished every Part A Level II record.',
      hint: 'Complete all Level II records in Part A.',
      ...l2,
    },
    {
      id: 'part_a',
      title: 'Part A Champion',
      description: 'Finished every Teaching Competency and Practical record.',
      hint: 'Complete all Part A records.',
      ...a,
    },
    {
      id: 'part_b',
      title: 'EPC Expert',
      description: 'Finished every Part B EPC record.',
      hint: 'Complete all Part B records.',
      ...b,
    },
    {
      id: 'swayam',
      title: 'SWAYAM Scholar',
      description: 'Completed the Part C SWAYAM online course.',
      hint: 'Set the SWAYAM course status to Completed on the Dashboard.',
      current: swayamDone ? 1 : 0,
      target: 1,
      earned: swayamDone,
      earned_at: null,
    },
    {
      id: 'steps_25',
      title: 'Step by Step',
      description: `Ticked ${STEPS_TARGET} checklist steps.`,
      hint: `Tick ${STEPS_TARGET} steps in the Subtask Manager.`,
      current: Math.min(stepsDone, STEPS_TARGET),
      target: STEPS_TARGET,
      earned: stepsDone >= STEPS_TARGET,
      earned_at: null,
    },
    {
      id: 'planner',
      title: 'Planner',
      description: `Set due dates on ${DUE_DATES_TARGET} records.`,
      hint: `Give ${DUE_DATES_TARGET} records a due date.`,
      current: Math.min(withDue, DUE_DATES_TARGET),
      target: DUE_DATES_TARGET,
      earned: withDue >= DUE_DATES_TARGET,
      earned_at: null,
    },
    {
      id: 'focused',
      title: 'Focused',
      description: 'Spent 10 hours working on records.',
      hint: 'Log 10 hours of time on your records.',
      current: Math.min(minutes, FOCUS_MINUTES_TARGET),
      target: FOCUS_MINUTES_TARGET,
      earned: minutes >= FOCUS_MINUTES_TARGET,
      earned_at: null,
    },
    {
      id: 'semester_star',
      title: 'Semester Star',
      description: 'Finished every record and the SWAYAM course.',
      hint: 'Complete every record and the SWAYAM course.',
      current: completed + (swayamDone ? 1 : 0),
      target: active.length + 1,
      earned: allDone && swayamDone,
      earned_at: null,
    },
  ];
  return list;
}

/**
 * The unearned badge closest to completion (by share of progress), if any.
 * Semester Star is the final goal, so it is only suggested once nothing else is left.
 */
export function nextAchievement(list: Achievement[]): Achievement | null {
  const allOpen = list.filter((a) => !a.earned && a.target > 0);
  const open = allOpen.filter((a) => a.id !== 'semester_star');
  if (open.length === 0) return allOpen[0] ?? null;
  return open.reduce((best, a) => (a.current / a.target > best.current / best.target ? a : best));
}
