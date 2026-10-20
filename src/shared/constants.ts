export const APP_NAME = 'Semester 3 – Productive App';

export const TEACHING_COMPETENCY_NOTE =
  'Teaching Competency (Level I & II): practical teaching demonstration before an invigilator, to be held later. Not tracked as a record.';

export const SWAYAM_INFO_TEXT =
  'SWAYAM Online Course — 1 credit / 20 marks (official). An online course, not a practical record.';

export const LOCAL_USE_NOTICE =
  'Personal local use only, no authentication, not for multi-user hosting.';

export const TASK_STATUSES = ['Not Started', 'In Progress', 'Completed'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_DIFFICULTIES = ['Easy', 'Medium', 'Hard'] as const;
export type TaskDifficulty = (typeof TASK_DIFFICULTIES)[number];

export const TASK_PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_LEVELS = ['Level I', 'Level II', 'N/A'] as const;
export type TaskLevel = (typeof TASK_LEVELS)[number];

export const COURSE_STATUSES = ['Not Started', 'In Progress', 'Completed'] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];

export const THEME_MODES = ['light', 'dark'] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

export const WEEK_STARTS = ['Mon', 'Sun'] as const;
export type WeekStart = (typeof WEEK_STARTS)[number];

export const DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];

export const TIME_FORMATS = ['12h', '24h'] as const;
export type TimeFormat = (typeof TIME_FORMATS)[number];

export const SYLLABUS_PARTS = ['Part A', 'Part B', 'Part C'] as const;
export type SyllabusPart = (typeof SYLLABUS_PARTS)[number];

export interface StudentProfile {
  id: number;
  name: string;
  roll_number: string;
  university: string;
  programme: string;
  semester: number;
  syllabus_pattern: string;
  academic_year: string;
  college: string;
  teaching_subject: string;
  updated_at: string;
}

export interface Category {
  id: number;
  seed_key: string | null;
  name: string;
  description: string;
  note: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  task_count?: number;
  completed_count?: number;
}

export interface Subtask {
  id: number;
  task_id: number;
  title: string;
  done: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface TaskNote {
  id: number;
  task_id: number | null;
  task_title?: string | null;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface FocusSession {
  id: number;
  task_id: number | null;
  task_title: string;
  duration_minutes: number;
  started_at: string;
  ended_at: string | null;
  notes: string;
  created_at: string;
}

export interface TaskActivity {
  id: number;
  entity_type: 'task' | 'course' | 'system';
  task_id: number | null;
  task_title: string;
  action: string;
  from_value: string | null;
  to_value: string | null;
  created_at: string;
}

export interface Task {
  id: number;
  seed_key: string | null;
  title: string;
  category_id: number;
  category_name?: string;
  category_seed_key?: string | null;
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
  time_spent_minutes: number;
  subtask_total: number;
  subtask_done: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  archived_at: string | null;
}

export interface TaskDetail extends Task {
  subtasks: Subtask[];
  task_notes: TaskNote[];
  focus_sessions: FocusSession[];
  activity: TaskActivity[];
}

export interface AppSettings {
  id: number;
  theme: ThemeMode;
  week_start: WeekStart;
  date_format: DateFormat;
  time_format: TimeFormat;
  db_created_at: string;
  db_path: string;
  updated_at: string;
}

export interface SyllabusSummaryItem {
  part: SyllabusPart;
  title: string;
  official_credits: number;
  official_marks: number;
  note: string;
  course_status: CourseStatus | null;
  updated_at: string;
  tracked_task_count: number;
  planning_credits_sum: number;
  planning_marks_sum: number;
  completed_task_count: number;
  in_progress_task_count: number;
  not_started_task_count: number;
  computed_discrepancy_note: string | null;
}

export interface SyllabusOverviewResponse {
  parts: SyllabusSummaryItem[];
  teaching_competency_note: string;
  official_totals: {
    credits: number;
    marks: number;
  };
  planning_totals: {
    credits: number;
    marks: number;
    tracked_tasks: number;
  };
}

export interface CategoryStatusChartRow {
  category_id: number;
  category_name: string;
  short_name: string;
  seed_key: string | null;
  not_started: number;
  in_progress: number;
  completed: number;
  total: number;
}

export interface DashboardSummary {
  today: string;
  total: number;
  completed: number;
  in_progress: number;
  pending: number;
  overdue: number;
  completion_percentage: number;
  by_difficulty: Record<TaskDifficulty, number>;
  by_priority: Record<TaskPriority, number>;
  by_category: CategoryStatusChartRow[];
  upcoming_and_overdue: Task[];
  syllabus: SyllabusOverviewResponse;
}

export interface RestoreSyllabusPreview {
  missing_tasks: Array<{ seed_key: string; title: string; part: string }>;
  archived_tasks: Array<{ id: number; seed_key: string; title: string; part: string }>;
  missing_categories: Array<{ seed_key: string; name: string }>;
  total_to_restore: number;
}

export interface AuthUser {
  id: number;
  username: string;
  display_name: string;
  roll_number: string;
  db_filename: string;
  created_at: string;
}

export interface AuthSessionResponse {
  authenticated: boolean;
  user: AuthUser | null;
  admin_authenticated?: boolean;
  admin_username?: string | null;
}

export interface AdminWorkspaceStat {
  id: string;
  label: string;
  username: string;
  roll_number: string;
  college: string;
  total_records: number;
  completed: number;
  in_progress: number;
  not_started: number;
  overdue: number;
  completion_percentage: number;
  part_a_completed: number;
  part_a_total: number;
  part_b_completed: number;
  part_b_total: number;
  part_c_status: CourseStatus;
  notes_count: number;
  focus_minutes: number;
  last_updated_at: string | null;
}

export interface AdminAnalyticsResponse {
  admin_username: string;
  generated_at: string;
  totals: {
    total_workspaces: number;
    registered_students: number;
    total_records: number;
    completed_records: number;
    in_progress_records: number;
    not_started_records: number;
    overdue_records: number;
    completion_rate: number;
    swayam_completed_count: number;
    total_notes: number;
    total_focus_minutes: number;
  };
  workspaces: AdminWorkspaceStat[];
}



