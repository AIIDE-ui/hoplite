import type {
  DateFormat,
  TaskDifficulty,
  TaskPriority,
  TaskStatus,
  TimeFormat,
} from './constants.ts';

export interface StatTaskInput {
  status: TaskStatus;
  difficulty: TaskDifficulty;
  priority: TaskPriority;
  category_id: number;
  due_date: string | null;
  archived_at: string | null;
}

export function calculateCompletionPercentage(completed: number, total: number): number {
  if (total <= 0 || completed <= 0) return 0;
  return Math.round((completed / total) * 100);
}

export function isTaskOverdue(
  dueDate: string | null | undefined,
  status: TaskStatus,
  today: string
): boolean {
  if (!dueDate) return false;
  if (status === 'Completed') return false;
  return dueDate < today;
}

export function calculateTimeSpentMinutes(
  focusSessionDurations: number[],
  manualMinutesAdjustment: number
): number {
  const focusSum = focusSessionDurations.reduce((acc, val) => acc + (Number(val) || 0), 0);
  return Math.max(0, focusSum + (Number(manualMinutesAdjustment) || 0));
}

export function shouldSuggestTaskCompletion(
  taskStatus: TaskStatus,
  subtasks: Array<{ done: boolean | number }>
): boolean {
  if (taskStatus === 'Completed') return false;
  if (subtasks.length === 0) return false;
  return subtasks.every((s) => Boolean(s.done));
}

export function formatPartAPlanningNote(
  officialCredits: number,
  officialMarks: number,
  trackedTaskCount: number,
  planningCredits: number,
  planningMarks: number
): string {
  const formatNum = (n: number) => (Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2))));
  return `The official Part A total (${formatNum(officialCredits)} credits / ${formatNum(officialMarks)} marks) is larger than the planning split of the ${trackedTaskCount} tracked Part A tasks (${formatNum(planningCredits)} / ${formatNum(planningMarks)}). The difference is not allocated to any tracked record.`;
}

export function computeTaskStatistics(tasks: StatTaskInput[], today: string) {
  const active = tasks.filter((t) => !t.archived_at);
  const total = active.length;
  let completed = 0;
  let in_progress = 0;
  let pending = 0;
  let overdue = 0;

  const by_difficulty: Record<TaskDifficulty, number> = {
    Easy: 0,
    Medium: 0,
    Hard: 0,
  };

  const by_priority: Record<TaskPriority, number> = {
    Low: 0,
    Normal: 0,
    High: 0,
    Urgent: 0,
  };

  for (const t of active) {
    if (t.status === 'Completed') completed++;
    else if (t.status === 'In Progress') in_progress++;
    else pending++;

    if (isTaskOverdue(t.due_date, t.status, today)) {
      overdue++;
    }

    if (by_difficulty[t.difficulty] !== undefined) {
      by_difficulty[t.difficulty]++;
    }
    if (by_priority[t.priority] !== undefined) {
      by_priority[t.priority]++;
    }
  }

  return {
    total,
    completed,
    in_progress,
    pending,
    overdue,
    completion_percentage: calculateCompletionPercentage(completed, total),
    by_difficulty,
    by_priority,
  };
}

export function getLocalTodayYMD(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatPlainDate(
  ymd: string | null | undefined,
  dateFormat: DateFormat = 'DD/MM/YYYY'
): string {
  if (!ymd) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!match) return ymd;
  const [, yyyy, mm, dd] = match;
  if (dateFormat === 'DD/MM/YYYY') return `${dd}/${mm}/${yyyy}`;
  if (dateFormat === 'MM/DD/YYYY') return `${mm}/${dd}/${yyyy}`;
  return `${yyyy}-${mm}-${dd}`;
}

export function formatUtcTimestampLocal(
  iso: string | null | undefined,
  dateFormat: DateFormat = 'DD/MM/YYYY',
  timeFormat: TimeFormat = '12h'
): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const datePart = formatPlainDate(`${year}-${month}-${day}`, dateFormat);

  const hours24 = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  if (timeFormat === '24h') {
    return `${datePart}, ${String(hours24).padStart(2, '0')}:${minutes}`;
  }
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  return `${datePart}, ${hours12}:${minutes} ${period}`;
}

export function formatMinutesHuman(minutes: number): string {
  const m = Math.round(Number(minutes) || 0);
  if (m === 0) return '0m';
  const abs = Math.abs(m);
  const sign = m < 0 ? '-' : '';
  const hrs = Math.floor(abs / 60);
  const rem = abs % 60;
  if (hrs > 0 && rem > 0) return `${sign}${hrs}h ${rem}m`;
  if (hrs > 0) return `${sign}${hrs}h`;
  return `${sign}${rem}m`;
}
