import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  CheckCircle2,
  FileText,
  LayoutGrid,
  List,
  Play,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import {
  COURSE_STATUSES,
  SWAYAM_INFO_TEXT,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type AppSettings,
  type Category,
  type CourseStatus,
  type SyllabusOverviewResponse,
  type Task,
  type TaskStatus,
} from '../shared/constants.ts';
import {
  formatPlainDate,
  getLocalTodayYMD,
  isTaskOverdue,
} from '../shared/stats.ts';
import { PriorityText, StatusText } from '../components/StatusIndicator.tsx';
import { api, ApiClientError } from '../api/client.ts';
import { useFocusTrap } from '../hooks/useFocusTrap.ts';

interface RecordsViewProps {
  categories: Category[];
  settings: AppSettings | null;
  syllabus: SyllabusOverviewResponse | null;
  urlParams: URLSearchParams;
  dataVersion: number;
  onUpdateUrlParams: (nextParams: Record<string, string | undefined>) => void;
  onOpenTaskDetail: (taskId: number) => void;
  onDataChanged: () => Promise<void>;
}

export function RecordsView({
  categories,
  settings,
  syllabus,
  urlParams,
  dataVersion,
  onUpdateUrlParams,
  onOpenTaskDetail,
  onDataChanged,
}: RecordsViewProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'card'>('list');

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkStatus, setBulkStatus] = useState<TaskStatus>('Completed');

  // Quick action modals
  const [dueModalTask, setDueModalTask] = useState<Task | null>(null);
  const [dueModalValue, setDueModalValue] = useState('');
  const [noteModalTask, setNoteModalTask] = useState<Task | null>(null);
  const [noteModalTitle, setNoteModalTitle] = useState('');
  const [noteModalContent, setNoteModalContent] = useState('');
  const dueModalRef = useFocusTrap<HTMLFormElement>(dueModalTask !== null);
  const noteModalRef = useFocusTrap<HTMLFormElement>(noteModalTask !== null);

  const [updatingCourseStatus, setUpdatingCourseStatus] = useState(false);

  // Read filters from URL query params
  const search = urlParams.get('search') || '';
  const category = urlParams.get('category') || 'all';
  const status = urlParams.get('status') || 'all';
  const priority = urlParams.get('priority') || 'all';
  const due = urlParams.get('due') || 'all';
  const dueFrom = urlParams.get('dueFrom') || '';
  const dueTo = urlParams.get('dueTo') || '';
  const sort = urlParams.get('sort') || 'manual';
  const order = urlParams.get('order') || 'asc';
  const page = Math.max(1, Number(urlParams.get('page') || 1));

  const today = getLocalTodayYMD();
  const dateFormat = settings?.date_format ?? 'DD/MM/YYYY';

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getTasks({
        search: search || undefined,
        category: category !== 'all' ? category : undefined,
        status: status !== 'all' ? status : undefined,
        priority: priority !== 'all' ? priority : undefined,
        due: due !== 'all' ? due : undefined,
        dueFrom: due === 'range' && dueFrom ? dueFrom : undefined,
        dueTo: due === 'range' && dueTo ? dueTo : undefined,
        sort,
        order,
        page,
        pageSize: 20,
        today,
      });
      setTasks(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
      setSelectedIds([]);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to load records.');
    } finally {
      setLoading(false);
    }
  }, [search, category, status, priority, due, dueFrom, dueTo, sort, order, page, today, dataVersion]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    if (!dueModalTask && !noteModalTask) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDueModalTask(null);
        setNoteModalTask(null);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [dueModalTask, noteModalTask]);

  const setFilter = (key: string, value: string | undefined) => {
    onUpdateUrlParams({
      [key]: value && value !== 'all' ? value : undefined,
      page: '1',
    });
  };

  const clearAllFilters = () => {
    onUpdateUrlParams({
      search: undefined,
      category: undefined,
      status: undefined,
      priority: undefined,
      due: undefined,
      dueFrom: undefined,
      dueTo: undefined,
      sort: undefined,
      order: undefined,
      page: undefined,
    });
  };

  const handleInlineStatusChange = async (taskId: number, nextStatus: TaskStatus) => {
    try {
      const updated = await api.updateTask(taskId, { status: nextStatus });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      await onDataChanged();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to update status.');
    }
  };

  const handleMoveOrder = async (taskId: number, direction: 'up' | 'down') => {
    try {
      await api.reorderTask({ taskId, direction });
      await fetchTasks();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to reorder record.');
    }
  };

  const handleBulkStatusApply = async () => {
    if (selectedIds.length === 0) return;
    try {
      await api.bulkTasks({
        taskIds: selectedIds,
        action: 'status',
        status: bulkStatus,
      });
      await onDataChanged();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Bulk status update failed.');
    }
  };

  const handleSaveQuickDueDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dueModalTask) return;
    try {
      const updated = await api.updateTask(dueModalTask.id, {
        due_date: dueModalValue || null,
      });
      setTasks((prev) => prev.map((t) => (t.id === dueModalTask.id ? updated : t)));
      setDueModalTask(null);
      await onDataChanged();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not update due date.');
    }
  };

  const handleSaveQuickNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteModalTask || !noteModalContent.trim()) return;
    try {
      await api.createNote({
        task_id: noteModalTask.id,
        title: noteModalTitle.trim(),
        content: noteModalContent.trim(),
      });
      setNoteModalTask(null);
      setNoteModalTitle('');
      setNoteModalContent('');
      await fetchTasks();
      await onDataChanged();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not save note.');
    }
  };

  const handlePartCCourseStatusChange = async (nextStatus: CourseStatus) => {
    setUpdatingCourseStatus(true);
    try {
      await api.updateSyllabusPart('Part C', { course_status: nextStatus });
      await onDataChanged();
    } finally {
      setUpdatingCourseStatus(false);
    }
  };

  const partCCategory = categories.find((c) => c.seed_key === 'part_c');
  const partCSummary = syllabus?.parts.find((p) => p.part === 'Part C');
  const isPartCView =
    category === 'part_c' || (partCCategory && String(partCCategory.id) === category);

  const presets = [
    { key: 'all', label: 'All Records' },
    { key: 'part_a', label: 'Part A' },
    { key: 'part_b', label: 'Part B' },
    { key: 'part_c', label: 'Part C — Online Course (SWAYAM)' },
  ];

  // Active filter items
  const activeChips: Array<{ key: string; label: string; clear: () => void }> = [];
  if (search) {
    activeChips.push({
      key: 'search',
      label: `Search: "${search}"`,
      clear: () => setFilter('search', undefined),
    });
  }
  if (category !== 'all') {
    const matchedCat = categories.find(
      (c) => c.seed_key === category || String(c.id) === category
    );
    activeChips.push({
      key: 'category',
      label: `Category: ${matchedCat ? matchedCat.name : category}`,
      clear: () => setFilter('category', undefined),
    });
  }
  if (status !== 'all') {
    activeChips.push({
      key: 'status',
      label: `Status: ${status}`,
      clear: () => setFilter('status', undefined),
    });
  }
  if (priority !== 'all') {
    activeChips.push({
      key: 'priority',
      label: `Priority: ${priority}`,
      clear: () => setFilter('priority', undefined),
    });
  }
  if (due !== 'all') {
    activeChips.push({
      key: 'due',
      label: `Due: ${due}`,
      clear: () =>
        onUpdateUrlParams({ due: undefined, dueFrom: undefined, dueTo: undefined, page: '1' }),
    });
  }

  const allSelected = tasks.length > 0 && selectedIds.length === tasks.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(tasks.map((t) => t.id));
    }
  };

  const toggleSelectOne = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100">
            Practical Records
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Official TNTEU B.Ed. Semester III practical records and SWAYAM online course tracker.
          </p>
        </div>
      </div>

      {/* Category Presets */}
      <div
        className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-800 overflow-x-auto"
        role="tablist"
        aria-label="Record Category Presets"
      >
        {presets.map((preset) => {
          const isActive = category === preset.key;
          return (
            <button
              key={preset.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setFilter('category', preset.key === 'all' ? undefined : preset.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {/* Part C — Online Course (SWAYAM) Info Card when viewing Part C */}
      {isPartCView && (
        <section
          aria-label="SWAYAM Online Course Information"
          className="p-4 sm:p-5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-4"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                {partCSummary?.title || 'Part C — Online Course (SWAYAM)'}
              </h2>
              <p className="text-xs text-slate-700 dark:text-zinc-300">
                {SWAYAM_INFO_TEXT}
              </p>
              {partCSummary?.note && partCSummary.note !== SWAYAM_INFO_TEXT && (
                <p className="text-xs text-slate-500 dark:text-zinc-400">{partCSummary.note}</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
                <label
                  htmlFor="records-part-c-course-status"
                  className="text-xs font-medium text-slate-700 dark:text-zinc-300"
                >
                  Course status (not counted in record progress):
                </label>
                <select
                  id="records-part-c-course-status"
                  disabled={updatingCourseStatus}
                  value={partCSummary?.course_status ?? 'Not Started'}
                  onChange={(e) => handlePartCCourseStatusChange(e.target.value as CourseStatus)}
                  className="w-full sm:w-auto px-2.5 py-1.5 text-xs font-medium rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100"
                >
                  {COURSE_STATUSES.map((cs) => (
                    <option key={cs} value={cs}>
                      {cs}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Search, Filters, Sort & View Toggle Bar */}
      <section
        aria-label="Search and Filter Controls"
        className="p-3.5 sm:p-4 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-3"
      >
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-2.5 sm:gap-3">
          {/* Search */}
          <div className="col-span-2 lg:col-span-2 relative">
            <Search
              className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Search records by title or notes"
              value={search}
              onChange={(e) => setFilter('search', e.target.value || undefined)}
              placeholder="Search title or notes…"
              className="w-full pl-9 pr-3 py-2 sm:py-1.5 text-xs rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100"
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              aria-label="Filter by category"
              value={category}
              onChange={(e) => setFilter('category', e.target.value)}
              className="w-full px-2.5 py-2 sm:py-1.5 text-xs rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100"
            >
              <option value="all">All Categories</option>
              <option value="part_a">Part A</option>
              <option value="part_b">Part B</option>
              <option value="part_c">Part C — Online Course (SWAYAM)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              aria-label="Filter by status"
              value={status}
              onChange={(e) => setFilter('status', e.target.value)}
              className="w-full px-2.5 py-2 sm:py-1.5 text-xs rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100"
            >
              <option value="all">All Statuses</option>
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <select
              aria-label="Filter by priority"
              value={priority}
              onChange={(e) => setFilter('priority', e.target.value)}
              className="w-full px-2.5 py-2 sm:py-1.5 text-xs rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100"
            >
              <option value="all">All Priorities</option>
              {TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Due Filter */}
          <div>
            <select
              aria-label="Filter by due date"
              value={due}
              onChange={(e) => setFilter('due', e.target.value)}
              className="w-full px-2.5 py-2 sm:py-1.5 text-xs rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100"
            >
              <option value="all">Any Due Date</option>
              <option value="overdue">Overdue</option>
              <option value="today">Due Today</option>
              <option value="week">Due Next 7 Days</option>
              <option value="none">No Due Date</option>
              <option value="range">Date Range…</option>
            </select>
          </div>
        </div>

        {due === 'range' && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 dark:border-zinc-800 text-xs">
            <label className="flex items-center gap-1.5 text-slate-600 dark:text-zinc-400">
              <span>From:</span>
              <input
                type="date"
                value={dueFrom}
                onChange={(e) =>
                  onUpdateUrlParams({ dueFrom: e.target.value || undefined, page: '1' })
                }
                className="px-2 py-1 rounded border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
              />
            </label>
            <label className="flex items-center gap-1.5 text-slate-600 dark:text-zinc-400">
              <span>To:</span>
              <input
                type="date"
                value={dueTo}
                onChange={(e) =>
                  onUpdateUrlParams({ dueTo: e.target.value || undefined, page: '1' })
                }
                className="px-2 py-1 rounded border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
              />
            </label>
          </div>
        )}

        {/* Sort & View Mode Row */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-100 dark:border-zinc-800">
          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor="records-sort-select"
              className="text-xs text-slate-500 dark:text-zinc-400"
            >
              Sort by:
            </label>
            <select
              id="records-sort-select"
              value={sort}
              onChange={(e) =>
                onUpdateUrlParams({
                  sort: e.target.value === 'manual' ? undefined : e.target.value,
                })
              }
              className="px-2.5 py-1 text-xs rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100"
            >
              <option value="manual">Manual Order</option>
              <option value="title">Title</option>
              <option value="status">Status</option>
              <option value="due">Due Date</option>
              <option value="updated">Recently Updated</option>
            </select>

            <button
              type="button"
              onClick={() =>
                onUpdateUrlParams({ order: order === 'asc' ? 'desc' : 'asc' })
              }
              aria-label={`Sort direction: ${order === 'asc' ? 'Ascending' : 'Descending'}`}
              className="px-2.5 py-1 text-xs font-medium rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-900"
            >
              {order === 'asc' ? 'Asc ↑' : 'Desc ↓'}
            </button>

            {activeChips.length > 0 && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="px-2.5 py-1 text-xs font-medium text-rose-600 dark:text-rose-400 hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 dark:text-zinc-400 font-mono tabular-nums">
              {total} {total === 1 ? 'record' : 'records'}
            </span>
            <div
              className="inline-flex items-center p-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700"
              role="group"
              aria-label="View layout toggle"
            >
              <button
                type="button"
                onClick={() => setViewMode('list')}
                aria-label="Table list view"
                aria-pressed={viewMode === 'list'}
                className={`p-1.5 rounded text-xs ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-xs'
                    : 'text-slate-500 dark:text-zinc-400'
                }`}
              >
                <List className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('card')}
                aria-label="Card grid view"
                aria-pressed={viewMode === 'card'}
                className={`p-1.5 rounded text-xs ${
                  viewMode === 'card'
                    ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-xs'
                    : 'text-slate-500 dark:text-zinc-400'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        {/* Active Filter Chips (Interactive removal buttons) */}
        {activeChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-2">
            {activeChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={chip.clear}
                aria-label={`Remove filter ${chip.label}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700"
              >
                <span>{chip.label}</span>
                <X className="w-3 h-3" aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div
          role="region"
          aria-label="Bulk actions"
          className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800"
        >
          <span className="text-xs font-semibold text-slate-900 dark:text-zinc-200 font-mono tabular-nums">
            {selectedIds.length} selected
          </span>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Bulk status target"
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value as TaskStatus)}
              className="px-2.5 py-1 text-xs rounded border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100"
            >
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleBulkStatusApply}
              className="px-3 py-1 text-xs font-medium text-white dark:text-zinc-900 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded whitespace-nowrap"
            >
              Apply Status
            </button>
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="p-3 rounded-md bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300"
        >
          {error}
        </div>
      )}

      {/* Records List / Cards */}
      {loading && tasks.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-800">
          Loading records…
        </div>
      ) : tasks.length === 0 ? (
        <div className="p-10 text-center bg-white dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-800 space-y-3">
          <p className="text-sm font-medium text-slate-800 dark:text-zinc-200">
            No practical records match the current view.
          </p>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            {isPartCView
              ? 'Part C is an online course (SWAYAM) tracked via the Course Status selector above.'
              : 'Try clearing your active filters to view all official syllabus records.'}
          </p>
          {activeChips.length > 0 && (
            <div className="flex items-center justify-center pt-1">
              <button
                type="button"
                onClick={clearAllFilters}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800 rounded-md"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div
            className={`${
              viewMode === 'card' ? 'hidden' : 'hidden md:block'
            } bg-white dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-800 overflow-x-auto`}
          >
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 bg-slate-50/60 dark:bg-zinc-950/40">
                  <th className="py-3 pl-4 pr-2 w-8">
                    <input
                      type="checkbox"
                      aria-label="Select all records on this page"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300 dark:border-zinc-700 text-blue-600"
                    />
                  </th>
                  <th className="py-3 px-3 font-medium">Record Title & Metadata</th>
                  <th className="py-3 px-3 font-medium">Status</th>
                  <th className="py-3 px-3 font-medium">Due Date</th>
                  <th className="py-3 pl-3 pr-4 font-medium text-right">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {tasks.map((task, idx) => {
                  const overdue = isTaskOverdue(task.due_date, task.status, today);
                  const isSelected = selectedIds.includes(task.id);
                  return (
                    <tr
                      key={task.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors ${
                        isSelected ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
                      }`}
                    >
                      <td className="py-3 pl-4 pr-2 align-top">
                        <input
                          type="checkbox"
                          aria-label={`Select ${task.title}`}
                          checked={isSelected}
                          onChange={() => toggleSelectOne(task.id)}
                          className="rounded border-slate-300 dark:border-zinc-700 text-blue-600 mt-0.5"
                        />
                      </td>

                      <td className="py-3 px-3 align-top">
                        <button
                          type="button"
                          onClick={() => onOpenTaskDetail(task.id)}
                          className="font-semibold text-slate-900 dark:text-zinc-100 hover:text-blue-600 dark:hover:text-blue-400 text-left block"
                        >
                          {task.title}
                        </button>
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                          <span>
                            {task.category_seed_key === 'part_a'
                              ? 'Part A'
                              : task.category_seed_key === 'part_b'
                                ? 'Part B'
                                : task.category_seed_key === 'part_c'
                                  ? 'Part C (SWAYAM)'
                                  : task.category_name}
                          </span>
                          {task.level !== 'N/A' && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{task.level}</span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <PriorityText priority={task.priority} />
                          {task.subtask_total > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums">
                                Subtasks {task.subtask_done}/{task.subtask_total}
                              </span>
                            </>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3 align-top whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <StatusText status={task.status} />
                          <select
                            aria-label={`Change status for ${task.title}`}
                            value={task.status}
                            onChange={(e) =>
                              handleInlineStatusChange(task.id, e.target.value as TaskStatus)
                            }
                            className="px-2 py-1 text-xs rounded border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-700 dark:text-zinc-300"
                          >
                            {TASK_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>

                      <td className="py-3 px-3 align-top whitespace-nowrap font-mono tabular-nums">
                        <button
                          type="button"
                          onClick={() => {
                            setDueModalTask(task);
                            setDueModalValue(task.due_date || '');
                          }}
                          className="inline-flex items-center gap-1.5 text-left hover:underline focus-visible:outline-2 focus-visible:outline-blue-600 rounded"
                        >
                          {task.due_date ? (
                            <span
                              className={
                                overdue
                                  ? 'text-rose-600 dark:text-rose-400 font-semibold'
                                  : 'text-slate-700 dark:text-zinc-300'
                              }
                            >
                              {overdue ? 'Overdue · ' : ''}
                              {formatPlainDate(task.due_date, dateFormat)}
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-zinc-500">—</span>
                          )}
                        </button>
                      </td>

                      <td className="py-3 pl-3 pr-4 align-top text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
                          {task.status === 'Not Started' && (
                            <button
                              type="button"
                              onClick={() => handleInlineStatusChange(task.id, 'In Progress')}
                              title="Start record"
                              aria-label={`Start ${task.title}`}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded"
                            >
                              <Play className="w-3 h-3" aria-hidden="true" />
                              <span>Start</span>
                            </button>
                          )}
                          {task.status === 'Completed' && (
                            <button
                              type="button"
                              onClick={() => handleInlineStatusChange(task.id, 'In Progress')}
                              title="Resume record"
                              aria-label={`Resume ${task.title}`}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded"
                            >
                              <RotateCcw className="w-3 h-3" aria-hidden="true" />
                              <span>Resume</span>
                            </button>
                          )}
                          {task.status !== 'Completed' && (
                            <button
                              type="button"
                              onClick={() => handleInlineStatusChange(task.id, 'Completed')}
                              title="Mark completed"
                              aria-label={`Mark ${task.title} completed`}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded"
                            >
                              <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                              <span>Complete</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setDueModalTask(task);
                              setDueModalValue(task.due_date || '');
                            }}
                            title="Set due date"
                            aria-label={`Set due date for ${task.title}`}
                            className="p-1 text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100 rounded"
                          >
                            <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setNoteModalTask(task);
                              setNoteModalTitle('');
                              setNoteModalContent('');
                            }}
                            title="Add note"
                            aria-label={`Add note to ${task.title}`}
                            className="p-1 text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100 rounded"
                          >
                            <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>

                          <button
                            type="button"
                            disabled={sort !== 'manual' || (idx === 0 && page === 1)}
                            onClick={() => handleMoveOrder(task.id, 'up')}
                            title={
                              sort !== 'manual'
                                ? 'Switch sort to Manual Order to reorder'
                                : 'Move up'
                            }
                            aria-label={`Move ${task.title} up`}
                            className="p-1 text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100 disabled:opacity-30 rounded"
                          >
                            <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>

                          <button
                            type="button"
                            disabled={
                              sort !== 'manual' ||
                              (idx === tasks.length - 1 && page === totalPages)
                            }
                            onClick={() => handleMoveOrder(task.id, 'down')}
                            title={
                              sort !== 'manual'
                                ? 'Switch sort to Manual Order to reorder'
                                : 'Move down'
                            }
                            aria-label={`Move ${task.title} down`}
                            className="p-1 text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100 disabled:opacity-30 rounded"
                          >
                            <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile & Card View */}
          <div
            className={`${
              viewMode === 'card' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'space-y-3 md:hidden'
            }`}
          >
            {tasks.map((task, idx) => {
              const overdue = isTaskOverdue(task.due_date, task.status, today);
              const isSelected = selectedIds.includes(task.id);
              return (
                <div
                  key={task.id}
                  className="p-3.5 sm:p-4 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        aria-label={`Select ${task.title}`}
                        checked={isSelected}
                        onChange={() => toggleSelectOne(task.id)}
                        className="mt-1 rounded border-slate-300 dark:border-zinc-700 text-blue-600 shrink-0"
                      />
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => onOpenTaskDetail(task.id)}
                          className="text-sm font-semibold text-slate-900 dark:text-zinc-100 hover:text-blue-600 dark:hover:text-blue-400 text-left block"
                        >
                          {task.title}
                        </button>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                          <span>
                            {task.category_seed_key === 'part_a'
                              ? 'Part A'
                              : task.category_seed_key === 'part_b'
                                ? 'Part B'
                                : task.category_seed_key === 'part_c'
                                  ? 'Part C (SWAYAM)'
                                  : task.category_name}
                          </span>
                          {task.level !== 'N/A' && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{task.level}</span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <PriorityText priority={task.priority} />
                          {task.subtask_total > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums">
                                Subtasks {task.subtask_done}/{task.subtask_total}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <StatusText status={task.status} />
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800 text-xs">
                    <div className="flex-1 min-w-0">
                      <label className="sr-only" htmlFor={`mobile-status-${task.id}`}>
                        Status for {task.title}
                      </label>
                      <select
                        id={`mobile-status-${task.id}`}
                        aria-label={`Mobile status for ${task.title}`}
                        value={task.status}
                        onChange={(e) =>
                          handleInlineStatusChange(task.id, e.target.value as TaskStatus)
                        }
                        className="w-full px-2.5 py-1.5 text-xs rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-800 dark:text-zinc-200"
                      >
                        {TASK_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setDueModalTask(task);
                        setDueModalValue(task.due_date || '');
                      }}
                      aria-label={`Set due date for ${task.title}`}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/70 font-mono tabular-nums shrink-0 ${
                        overdue
                          ? 'text-rose-600 dark:text-rose-400 font-semibold border-rose-300 dark:border-rose-800'
                          : 'text-slate-700 dark:text-zinc-300'
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>
                        {task.due_date
                          ? formatPlainDate(task.due_date, dateFormat)
                          : 'Set due'}
                      </span>
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800 text-xs">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setNoteModalTask(task);
                          setNoteModalTitle('');
                          setNoteModalContent('');
                        }}
                        aria-label={`Add note to ${task.title}`}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded"
                      >
                        <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Note</span>
                      </button>

                      <button
                        type="button"
                        disabled={sort !== 'manual' || (idx === 0 && page === 1)}
                        onClick={() => handleMoveOrder(task.id, 'up')}
                        aria-label={`Move ${task.title} up`}
                        className="p-1 text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100 disabled:opacity-30 rounded"
                      >
                        <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>

                      <button
                        type="button"
                        disabled={
                          sort !== 'manual' ||
                          (idx === tasks.length - 1 && page === totalPages)
                        }
                        onClick={() => handleMoveOrder(task.id, 'down')}
                        aria-label={`Move ${task.title} down`}
                        className="p-1 text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100 disabled:opacity-30 rounded"
                      >
                        <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {task.status !== 'Completed' && (
                        <button
                          type="button"
                          onClick={() => handleInlineStatusChange(task.id, 'Completed')}
                          className="px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 rounded"
                        >
                          Complete
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onOpenTaskDetail(task.id)}
                        className="px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800 rounded"
                      >
                        Details
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-800 text-xs">
              <span className="text-slate-500 dark:text-zinc-400 font-mono tabular-nums">
                Page {page} of {totalPages} ({total} total)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => onUpdateUrlParams({ page: String(page - 1) })}
                  className="px-3 py-1.5 rounded border border-slate-300 dark:border-zinc-700 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => onUpdateUrlParams({ page: String(page + 1) })}
                  className="px-3 py-1.5 rounded border border-slate-300 dark:border-zinc-700 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Quick Due Date Dialog */}
      {dueModalTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-due-title"
        >
          <form
            ref={dueModalRef}
            onSubmit={handleSaveQuickDueDate}
            className="w-full max-w-sm rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 space-y-4 shadow-lg"
          >
            <div className="flex items-center justify-between">
              <h3
                id="quick-due-title"
                className="text-sm font-semibold text-slate-900 dark:text-zinc-100"
              >
                Set Due Date
              </h3>
              <button
                type="button"
                onClick={() => setDueModalTask(null)}
                aria-label="Close due date dialog"
                className="text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600 dark:text-zinc-400">{dueModalTask.title}</p>
            <input
              type="date"
              aria-label="Due date"
              value={dueModalValue}
              onChange={(e) => setDueModalValue(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
            />
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setDueModalValue('')}
                className="text-xs text-rose-600 hover:underline"
              >
                Clear Date
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDueModalTask(null)}
                  className="px-3 py-1.5 text-xs bg-slate-100 dark:bg-zinc-800 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                >
                  Save Date
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Quick Add Note Dialog */}
      {noteModalTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-note-title"
        >
          <form
            ref={noteModalRef}
            onSubmit={handleSaveQuickNote}
            className="w-full max-w-md rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 space-y-4 shadow-lg"
          >
            <div className="flex items-center justify-between">
              <h3
                id="quick-note-title"
                className="text-sm font-semibold text-slate-900 dark:text-zinc-100"
              >
                Add Note to Record
              </h3>
              <button
                type="button"
                onClick={() => setNoteModalTask(null)}
                aria-label="Close add note dialog"
                className="text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600 dark:text-zinc-400">{noteModalTask.title}</p>
            <input
              type="text"
              aria-label="Note title"
              value={noteModalTitle}
              onChange={(e) => setNoteModalTitle(e.target.value)}
              placeholder="Note title (optional)"
              className="w-full px-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
            />
            <textarea
              rows={3}
              required
              aria-label="Note content"
              value={noteModalContent}
              onChange={(e) => setNoteModalContent(e.target.value)}
              placeholder="Write your note…"
              className="w-full px-3 py-2 text-xs rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setNoteModalTask(null)}
                className="px-3 py-1.5 text-xs bg-slate-100 dark:bg-zinc-800 rounded-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
              >
                Save Note
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
