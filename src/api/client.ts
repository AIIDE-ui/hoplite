import type {
  AdminAnalyticsResponse,
  AdminWorkspaceStat,
  AppSettings,
  AuthSessionResponse,
  Category,
  CourseStatus,
  DashboardSummary,
  FocusSession,
  RestoreSyllabusPreview,
  StudentProfile,
  Subtask,
  SyllabusOverviewResponse,
  Task,
  TaskActivity,
  TaskDetail,
  TaskDifficulty,
  TaskLevel,
  TaskNote,
  TaskPriority,
  TaskStatus,
} from '../shared/constants.ts';
import { getLocalTodayYMD } from '../shared/stats.ts';

export class ApiClientError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly fields?: Record<string, string>;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    fields?: Record<string, string>
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
    this.code = code;
    this.fields = fields;
  }
}

async function requestJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    headers.set('Content-Type', 'application/json');
    if (!options.body) {
      options.body = JSON.stringify({});
    }
  }

  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers,
  });

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    // Non-JSON response
  }

  if (!res.ok) {
    const errObj =
      payload && typeof payload === 'object' && 'error' in payload
        ? (payload as {
            error: { code?: string; message?: string; fields?: Record<string, string> };
          }).error
        : null;
    throw new ApiClientError(
      res.status,
      errObj?.code || 'API_ERROR',
      errObj?.message || `Request failed with status ${res.status}`,
      errObj?.fields
    );
  }

  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

export const api = {
  getHealth: () => requestJson<{ status: string; timestamp: string }>('/api/health'),

  // Multi-User Workspace Auth (Isolated SQLite DB per student/friend)
  getAuthSession: () => requestJson<AuthSessionResponse>('/api/auth/session'),
  registerWorkspaceUser: (body: {
    username: string;
    display_name: string;
    roll_number?: string;
    password: string;
  }) =>
    requestJson<AuthSessionResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  loginWorkspaceUser: (body: { username: string; password: string }) =>
    requestJson<AuthSessionResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  logoutWorkspaceUser: () =>
    requestJson<AuthSessionResponse>('/api/auth/logout', {
      method: 'POST',
    }),

  // Separate Admin Authentication & Simple Analytics
  loginAdmin: (body: { username: string; password: string }) =>
    requestJson<AuthSessionResponse>('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  logoutAdmin: () =>
    requestJson<AuthSessionResponse>('/api/admin/logout', {
      method: 'POST',
    }),
  getAdminAnalytics: () => requestJson<AdminAnalyticsResponse>('/api/admin/analytics'),
  updateAdminCredentials: (body: {
    current_password: string;
    new_username?: string;
    new_password: string;
  }) =>
    requestJson<{ username: string; updated_at: string }>('/api/admin/credentials', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  updateAdminUser: (
    id: number,
    body: {
      username?: string;
      display_name?: string;
      roll_number?: string;
      college?: string;
      new_password?: string;
    }
  ) =>
    requestJson<AdminWorkspaceStat>(`/api/admin/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  deleteAdminUser: (id: number) =>
    requestJson<{ deleted: boolean; id: number; username: string }>(`/api/admin/users/${id}`, {
      method: 'DELETE',
    }),

  // Profile
  getProfile: () => requestJson<StudentProfile>('/api/profile'),
  updateProfile: (body: Omit<StudentProfile, 'id' | 'updated_at'>) =>
    requestJson<StudentProfile>('/api/profile', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  // Settings
  getSettings: () => requestJson<AppSettings>('/api/settings'),
  updateSettings: (
    body: Partial<Pick<AppSettings, 'theme' | 'week_start' | 'date_format' | 'time_format'>>
  ) =>
    requestJson<AppSettings>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  // Categories
  getCategories: () => requestJson<Category[]>('/api/categories'),
  createCategory: (body: { name: string; description?: string; note?: string }) =>
    requestJson<Category>('/api/categories', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateCategory: (
    id: number,
    body: { name?: string; description?: string; note?: string; sort_order?: number }
  ) =>
    requestJson<Category>(`/api/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  deleteCategory: (id: number) =>
    requestJson<{ deleted: boolean; id: number }>(`/api/categories/${id}`, {
      method: 'DELETE',
    }),

  // Dashboard
  getDashboardSummary: (today: string = getLocalTodayYMD()) =>
    requestJson<DashboardSummary>(`/api/dashboard/summary?today=${encodeURIComponent(today)}`),
  getRecentActivity: (limit = 20) =>
    requestJson<TaskActivity[]>(`/api/dashboard/activity?limit=${limit}`),

  // Syllabus
  getSyllabus: () => requestJson<SyllabusOverviewResponse>('/api/syllabus'),
  updateSyllabusPart: (
    part: string,
    body: {
      title?: string;
      official_credits?: number;
      official_marks?: number;
      note?: string;
      course_status?: CourseStatus | null;
      confirm?: boolean;
    }
  ) =>
    requestJson<SyllabusOverviewResponse>(`/api/syllabus/${encodeURIComponent(part)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  // Tasks
  getTasks: (params: Record<string, string | number | boolean | undefined> = {}) => {
    const sp = new URLSearchParams();
    if (!params.today) {
      sp.set('today', getLocalTodayYMD());
    }
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') {
        sp.set(k, String(v));
      }
    }
    return requestJson<{
      items: Task[];
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    }>(`/api/tasks?${sp.toString()}`);
  },
  getTaskDetail: (id: number) => requestJson<TaskDetail>(`/api/tasks/${id}`),
  createTask: (body: {
    title: string;
    category_id: number;
    level?: TaskLevel;
    status?: TaskStatus;
    difficulty?: TaskDifficulty;
    priority?: TaskPriority;
    start_date?: string | null;
    due_date?: string | null;
    notes?: string;
    estimated_minutes?: number;
    credits?: number;
    marks?: number;
    manual_minutes_adjustment?: number;
  }) =>
    requestJson<Task>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateTask: (
    id: number,
    body: Partial<{
      title: string;
      category_id: number;
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
    }>
  ) =>
    requestJson<Task>(`/api/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  softDeleteTask: (id: number) =>
    requestJson<Task>(`/api/tasks/${id}`, {
      method: 'DELETE',
    }),
  restoreTask: (id: number) =>
    requestJson<Task>(`/api/tasks/${id}/restore`, {
      method: 'POST',
    }),
  permanentDeleteTask: (id: number) =>
    requestJson<{ deleted: boolean; id: number; title: string }>(`/api/tasks/${id}/permanent`, {
      method: 'DELETE',
    }),
  reorderTask: (body: { taskIds?: number[]; taskId?: number; direction?: 'up' | 'down' }) =>
    requestJson<{ updated: number }>('/api/tasks/reorder', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  bulkTasks: (body: {
    taskIds: number[];
    action: 'status' | 'archive' | 'restore';
    status?: TaskStatus;
  }) =>
    requestJson<{ updatedCount: number; tasks: Task[] }>('/api/tasks/bulk', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  // Restore Syllabus
  previewRestoreSyllabus: () =>
    requestJson<RestoreSyllabusPreview>('/api/tasks/restore-syllabus/preview'),
  restoreSyllabus: () =>
    requestJson<{
      restored_missing_tasks: number;
      unarchived_tasks: number;
      restored_categories: number;
      preview: RestoreSyllabusPreview;
    }>('/api/tasks/restore-syllabus', {
      method: 'POST',
      body: JSON.stringify({ confirm: true }),
    }),

  // Subtasks
  getSubtasks: (taskId: number) => requestJson<Subtask[]>(`/api/tasks/${taskId}/subtasks`),
  createSubtask: (taskId: number, body: { title: string; done?: boolean }) =>
    requestJson<{ subtask: Subtask; subtasks: Subtask[]; suggest_complete: boolean }>(
      `/api/tasks/${taskId}/subtasks`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    ),
  updateSubtask: (
    subtaskId: number,
    body: { title?: string; done?: boolean; sort_order?: number }
  ) =>
    requestJson<{ subtask: Subtask; subtasks: Subtask[]; suggest_complete: boolean }>(
      `/api/subtasks/${subtaskId}`,
      {
        method: 'PUT',
        body: JSON.stringify(body),
      }
    ),
  deleteSubtask: (subtaskId: number) =>
    requestJson<{
      deleted: boolean;
      task_id: number;
      subtasks: Subtask[];
      suggest_complete: boolean;
    }>(`/api/subtasks/${subtaskId}`, {
      method: 'DELETE',
    }),

  // Focus Sessions
  getFocusSessions: (taskId: number) =>
    requestJson<FocusSession[]>(`/api/tasks/${taskId}/focus-sessions`),
  createFocusSession: (
    taskId: number,
    body: { duration_minutes: number; notes?: string; started_at?: string }
  ) =>
    requestJson<{ session: FocusSession; task: Task | null }>(
      `/api/tasks/${taskId}/focus-sessions`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    ),

  // Notes
  getNotes: (params: { taskId?: string; search?: string } = {}) => {
    const sp = new URLSearchParams();
    if (params.taskId) sp.set('taskId', params.taskId);
    if (params.search) sp.set('search', params.search);
    return requestJson<TaskNote[]>(`/api/notes?${sp.toString()}`);
  },
  createNote: (body: { task_id: number | null; title?: string; content: string }) =>
    requestJson<TaskNote>('/api/notes', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateNote: (
    id: number,
    body: { task_id?: number | null; title?: string; content?: string }
  ) =>
    requestJson<TaskNote>(`/api/notes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  deleteNote: (id: number) =>
    requestJson<{ deleted: boolean; id: number }>(`/api/notes/${id}`, {
      method: 'DELETE',
    }),

  // Backup
  getBackupJson: () => requestJson<Record<string, unknown>>('/api/backup/json'),
  importBackupJson: (backup: Record<string, unknown>) =>
    requestJson<{
      imported_tasks: number;
      imported_notes: number;
      imported_subtasks: number;
    }>('/api/backup/import', {
      method: 'POST',
      body: JSON.stringify({ confirm: true, backup }),
    }),
};
