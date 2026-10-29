import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ExternalLink, ListChecks, Plus, Search } from 'lucide-react';
import type { Subtask, Task } from '../shared/constants.ts';
import { api, ApiClientError } from '../api/client.ts';
import { calculateCompletionPercentage, shouldSuggestTaskCompletion } from '../shared/stats.ts';
import { getReportPartKey, type ReportPartKey } from '../shared/progressReport.ts';
import { StatusText } from '../components/StatusIndicator.tsx';

interface SubtaskManagerViewProps {
  urlParams: URLSearchParams;
  dataVersion: number;
  onUpdateUrlParams: (updates: Record<string, string | undefined>) => void;
  onOpenTaskDetail: (taskId: number) => void;
  onDataChanged: () => Promise<void>;
}

type PartFilter = 'all' | ReportPartKey;
type ShowFilter = 'all' | 'unfinished' | 'pending_steps' | 'no_steps';

const PART_SHORT: Record<ReportPartKey, string> = {
  part_a: 'Part A',
  part_b: 'Part B',
  part_c: 'Part C',
  custom: 'Custom',
};

const SUGGESTED_STEPS = [
  'Collect the record format from college',
  'Write the rough draft',
  'Get guide teacher signature',
  'Write the fair copy',
  'Submit the record',
];

const inputClass =
  'px-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100';

function ProgressBar({ done, total, label }: { done: number; total: number; label: string }) {
  const pct = calculateCompletionPercentage(done, total);
  return (
    <div
      className="w-full h-1.5 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={`h-full transition-all duration-200 ${pct === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function SubtaskManagerView({
  urlParams,
  dataVersion,
  onUpdateUrlParams,
  onOpenTaskDetail,
  onDataChanged,
}: SubtaskManagerViewProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [search, setSearch] = useState('');
  const [partFilter, setPartFilter] = useState<PartFilter>('all');
  const [showFilter, setShowFilter] = useState<ShowFilter>('all');

  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [loadingSubtasks, setLoadingSubtasks] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checklistRef = useRef<HTMLElement>(null);

  const selectedId = Number(urlParams.get('task')) || null;
  const selectedTask = tasks.find((t) => t.id === selectedId) ?? null;

  const loadTasks = useCallback(async () => {
    try {
      const res = await api.getTasks({ pageSize: 200, sort: 'manual' });
      setTasks(res.items);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Unable to load records.');
    } finally {
      setLoadingTasks(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks, dataVersion]);

  useEffect(() => {
    setEditingId(null);
    setConfirmDeleteId(null);
    if (!selectedId) {
      setSubtasks([]);
      return;
    }
    let cancelled = false;
    setLoadingSubtasks(true);
    api
      .getSubtasks(selectedId)
      .then((rows) => {
        if (!cancelled) setSubtasks(rows);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiClientError ? err.message : 'Unable to load steps.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSubtasks(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, dataVersion]);

  // Keep the record list's step counts in sync without refetching every record.
  const applySubtasks = useCallback((taskId: number, rows: Subtask[]) => {
    setSubtasks(rows);
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, subtask_total: rows.length, subtask_done: rows.filter((s) => s.done).length }
          : t
      )
    );
  }, []);

  const runAction = async (action: () => Promise<void>, failMessage: string) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : failMessage);
    } finally {
      setBusy(false);
    }
  };

  const selectTask = (id: number) => {
    onUpdateUrlParams({ task: String(id) });
    setNewTitle('');
    if (window.matchMedia('(max-width: 1023px)').matches) {
      requestAnimationFrame(() =>
        checklistRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      );
    }
  };

  const addStep = (title: string) => {
    if (!selectedId || !title.trim()) return;
    return runAction(async () => {
      const res = await api.createSubtask(selectedId, { title: title.trim() });
      applySubtasks(selectedId, res.subtasks);
      setNewTitle('');
    }, 'Unable to add the step.');
  };

  const toggleStep = (st: Subtask) =>
    runAction(async () => {
      const res = await api.updateSubtask(st.id, { done: !st.done });
      applySubtasks(st.task_id, res.subtasks);
    }, 'Unable to update the step.');

  const saveTitle = (st: Subtask) => {
    if (!editingTitle.trim()) return;
    return runAction(async () => {
      const res = await api.updateSubtask(st.id, { title: editingTitle.trim() });
      applySubtasks(st.task_id, res.subtasks);
      setEditingId(null);
    }, 'Unable to rename the step.');
  };

  const deleteStep = (st: Subtask) =>
    runAction(async () => {
      const res = await api.deleteSubtask(st.id);
      applySubtasks(res.task_id, res.subtasks);
      setConfirmDeleteId(null);
    }, 'Unable to delete the step.');

  const markCompleted = () => {
    if (!selectedId) return;
    return runAction(async () => {
      await api.updateTask(selectedId, { status: 'Completed' });
      await onDataChanged();
    }, 'Unable to mark the record completed.');
  };

  const visibleTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (q && !t.title.toLowerCase().includes(q)) return false;
      if (partFilter !== 'all' && getReportPartKey(t.category_seed_key) !== partFilter) return false;
      if (showFilter === 'unfinished' && t.status === 'Completed') return false;
      if (showFilter === 'pending_steps' && t.subtask_done >= t.subtask_total) return false;
      if (showFilter === 'no_steps' && t.subtask_total > 0) return false;
      return true;
    });
  }, [tasks, search, partFilter, showFilter]);

  const stepsDone = subtasks.filter((s) => s.done).length;
  const suggestComplete = selectedTask
    ? shouldSuggestTaskCompletion(selectedTask.status, subtasks)
    : false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100">Subtask Manager</h1>
        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
          Break each practical record into small steps and tick them off as you go. Pick a record
          from the list to see its checklist.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="p-3 rounded-md bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300"
        >
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] items-start">
        {/* Record picker */}
        <section
          aria-labelledby="subtask-records-heading"
          className="rounded-lg bg-white dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800"
        >
          <div className="p-4 space-y-2.5 border-b border-slate-200 dark:border-zinc-800">
            <h2
              id="subtask-records-heading"
              className="text-sm font-semibold text-slate-900 dark:text-zinc-100"
            >
              Records
            </h2>
            <div className="relative">
              <Search
                className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search records…"
                aria-label="Search records"
                className={`${inputClass} w-full pl-8`}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={partFilter}
                onChange={(e) => setPartFilter(e.target.value as PartFilter)}
                aria-label="Filter by part"
                className={inputClass}
              >
                <option value="all">All Parts</option>
                <option value="part_a">Part A</option>
                <option value="part_b">Part B</option>
                <option value="part_c">Part C (SWAYAM)</option>
                <option value="custom">Custom</option>
              </select>
              <select
                value={showFilter}
                onChange={(e) => setShowFilter(e.target.value as ShowFilter)}
                aria-label="Show records"
                className={inputClass}
              >
                <option value="all">All records</option>
                <option value="unfinished">Not completed</option>
                <option value="pending_steps">Has unticked steps</option>
                <option value="no_steps">No steps yet</option>
              </select>
            </div>
          </div>

          {loadingTasks ? (
            <p className="p-4 text-xs text-slate-500">Loading records…</p>
          ) : visibleTasks.length === 0 ? (
            <p className="p-4 text-xs text-slate-500">No records match these filters.</p>
          ) : (
            <ul className="max-h-80 lg:max-h-[calc(100vh-22rem)] overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800">
              {visibleTasks.map((t) => {
                const active = t.id === selectedId;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => selectTask(t.id)}
                      aria-current={active ? 'true' : undefined}
                      className={`w-full text-left px-4 py-3 space-y-1.5 transition-colors ${
                        active
                          ? 'bg-blue-50 dark:bg-blue-950/50'
                          : 'hover:bg-slate-50 dark:hover:bg-zinc-800/60'
                      }`}
                    >
                      <span
                        className={`block text-xs font-medium ${
                          active
                            ? 'text-blue-800 dark:text-blue-300'
                            : 'text-slate-800 dark:text-zinc-200'
                        }`}
                      >
                        {t.title}
                      </span>
                      <span className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-zinc-400">
                        <span>{PART_SHORT[getReportPartKey(t.category_seed_key)]}</span>
                        <span className="font-mono tabular-nums">
                          {t.subtask_total === 0
                            ? 'No steps yet'
                            : `${t.subtask_done}/${t.subtask_total} steps`}
                        </span>
                      </span>
                      {t.subtask_total > 0 && (
                        <ProgressBar
                          done={t.subtask_done}
                          total={t.subtask_total}
                          label={`${t.title} steps progress`}
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Checklist */}
        <section
          ref={checklistRef}
          aria-labelledby="subtask-checklist-heading"
          className="p-5 rounded-lg bg-white dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800 space-y-4 scroll-mt-20"
        >
          {!selectedTask ? (
            <div className="py-10 text-center space-y-2">
              <ListChecks className="w-8 h-8 mx-auto text-slate-400" aria-hidden="true" />
              <h2
                id="subtask-checklist-heading"
                className="text-sm font-semibold text-slate-900 dark:text-zinc-100"
              >
                Pick a record to see its steps
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto">
                Choose any practical record from the list. You can then add steps like “Write
                the fair copy” and tick them off one by one.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                    {PART_SHORT[getReportPartKey(selectedTask.category_seed_key)]}
                    {selectedTask.level !== 'N/A' ? ` · ${selectedTask.level}` : ''}
                  </p>
                  <h2
                    id="subtask-checklist-heading"
                    className="text-base font-semibold text-slate-900 dark:text-zinc-100"
                  >
                    {selectedTask.title}
                  </h2>
                  <StatusText status={selectedTask.status} />
                </div>
                <button
                  type="button"
                  onClick={() => onOpenTaskDetail(selectedTask.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-zinc-200 border border-slate-300 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-md whitespace-nowrap"
                >
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  Open full record
                </button>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700 dark:text-zinc-300">Steps done</span>
                  <span className="font-mono tabular-nums text-slate-600 dark:text-zinc-400">
                    {stepsDone} of {subtasks.length} (
                    {calculateCompletionPercentage(stepsDone, subtasks.length)}%)
                  </span>
                </div>
                <ProgressBar
                  done={stepsDone}
                  total={subtasks.length}
                  label="Checklist progress"
                />
              </div>

              {suggestComplete && (
                <div
                  role="region"
                  aria-label="Completion suggestion"
                  className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800"
                >
                  <div className="flex items-center gap-2 text-xs font-medium text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>All steps are ticked. Mark this record completed?</span>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={markCompleted}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-md whitespace-nowrap"
                  >
                    Mark Completed
                  </button>
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addStep(newTitle);
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Add a step (e.g., Get guide teacher signature)…"
                  aria-label="New step"
                  maxLength={200}
                  className={`${inputClass} flex-1 min-w-0`}
                />
                <button
                  type="submit"
                  disabled={busy || !newTitle.trim()}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-md whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  Add Step
                </button>
              </form>

              {loadingSubtasks ? (
                <p className="text-xs text-slate-500">Loading steps…</p>
              ) : subtasks.length === 0 ? (
                <div className="p-4 rounded-md border border-dashed border-slate-300 dark:border-zinc-700 space-y-2.5">
                  <p className="text-xs text-slate-600 dark:text-zinc-400">
                    No steps yet. Type your own above, or tap a common step to add it:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTED_STEPS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={busy}
                        onClick={() => addStep(s)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-zinc-200 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 disabled:opacity-50 rounded-full"
                      >
                        <Plus className="w-3 h-3" aria-hidden="true" />
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <ul className="divide-y divide-slate-200 dark:divide-zinc-800 border border-slate-200 dark:border-zinc-800 rounded-md">
                  {subtasks.map((st) => (
                    <li key={st.id} className="flex items-center justify-between gap-2 px-3 py-2.5 text-xs">
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <input
                          type="checkbox"
                          id={`sm-step-${st.id}`}
                          checked={st.done}
                          disabled={busy}
                          onChange={() => toggleStep(st)}
                          className="w-4 h-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        {editingId === st.id ? (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              saveTitle(st);
                            }}
                            className="flex items-center gap-1.5 flex-1 min-w-0"
                          >
                            <input
                              type="text"
                              aria-label="Edit step"
                              value={editingTitle}
                              maxLength={200}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              className={`${inputClass} flex-1 min-w-0 py-1`}
                              autoFocus
                            />
                            <button
                              type="submit"
                              disabled={busy || !editingTitle.trim()}
                              className="px-2 py-1 text-xs font-medium text-white bg-blue-600 disabled:opacity-50 rounded"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="px-2 py-1 text-xs text-slate-500"
                            >
                              Cancel
                            </button>
                          </form>
                        ) : (
                          <label
                            htmlFor={`sm-step-${st.id}`}
                            className={`cursor-pointer break-words ${
                              st.done
                                ? 'line-through text-slate-400 dark:text-zinc-500'
                                : 'text-slate-800 dark:text-zinc-200'
                            }`}
                          >
                            {st.title}
                          </label>
                        )}
                      </div>
                      {editingId !== st.id && (
                        <div className="flex items-center gap-2.5 shrink-0">
                          {confirmDeleteId === st.id ? (
                            <>
                              <span className="text-slate-500">Delete?</span>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => deleteStep(st)}
                                className="font-medium text-rose-600 hover:text-rose-700"
                              >
                                Yes
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="text-slate-500"
                              >
                                No
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingId(st.id);
                                  setEditingTitle(st.title);
                                  setConfirmDeleteId(null);
                                }}
                                aria-label={`Edit step ${st.title}`}
                                className="text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(st.id)}
                                aria-label={`Delete step ${st.title}`}
                                className="text-rose-600 hover:text-rose-700"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
