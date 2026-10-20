import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  History,
  Plus,
  X,
  FileText,
  CheckSquare,
} from 'lucide-react';
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type AppSettings,
  type Category,
  type TaskDetail,
  type TaskPriority,
  type TaskStatus,
} from '../shared/constants.ts';
import {
  formatUtcTimestampLocal,
  shouldSuggestTaskCompletion,
} from '../shared/stats.ts';
import { api, ApiClientError } from '../api/client.ts';
import { useFocusTrap } from '../hooks/useFocusTrap.ts';

interface TaskDetailDrawerProps {
  taskId: number | null;
  categories: Category[];
  settings: AppSettings | null;
  onClose: () => void;
  onUpdated: () => void;
}

export function TaskDetailDrawer({
  taskId,
  settings,
  onClose,
  onUpdated,
}: TaskDetailDrawerProps) {
  const drawerRef = useFocusTrap<HTMLDivElement>(taskId !== null);
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Form state
  const [status, setStatus] = useState<TaskStatus>('Not Started');
  const [priority, setPriority] = useState<TaskPriority>('Normal');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');

  // Subtask form
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [editingSubtaskId, setEditingSubtaskId] = useState<number | null>(null);
  const [editingSubtaskTitle, setEditingSubtaskTitle] = useState('');

  // Task note form
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');

  const populateForm = useCallback((d: TaskDetail) => {
    setStatus(d.status);
    setPriority(d.priority);
    setStartDate(d.start_date ?? '');
    setDueDate(d.due_date ?? '');
    setNotes(d.notes ?? '');
  }, []);

  const loadDetail = useCallback(
    async (id: number, silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const d = await api.getTaskDetail(id);
        setDetail(d);
        if (!silent) {
          populateForm(d);
        }
      } catch (err) {
        setError(err instanceof ApiClientError ? err.message : 'Failed to load record details.');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [populateForm]
  );

  useEffect(() => {
    if (taskId !== null) {
      setFieldErrors({});
      setSavedMsg(null);
      loadDetail(taskId, false);
    } else {
      setDetail(null);
    }
  }, [taskId, loadDetail]);

  useEffect(() => {
    if (taskId === null) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [taskId, onClose]);

  if (taskId === null) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    setSaving(true);
    setSavedMsg(null);
    setError(null);
    setFieldErrors({});

    try {
      await api.updateTask(detail.id, {
        status,
        priority,
        start_date: startDate || null,
        due_date: dueDate || null,
        notes,
      });
      const refreshed = await api.getTaskDetail(detail.id);
      setDetail(refreshed);
      populateForm(refreshed);
      setSavedMsg('Record changes saved.');
      onUpdated();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
        if (err.fields) setFieldErrors(err.fields);
      } else {
        setError('Could not save record changes.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail || !newSubtaskTitle.trim()) return;
    try {
      const res = await api.createSubtask(detail.id, { title: newSubtaskTitle.trim() });
      setNewSubtaskTitle('');
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              subtasks: res.subtasks,
              subtask_total: res.subtasks.length,
              subtask_done: res.subtasks.filter((s) => s.done).length,
            }
          : prev
      );
      onUpdated();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to add subtask.');
    }
  };

  const handleToggleSubtask = async (subtaskId: number, currentDone: boolean) => {
    if (!detail) return;
    try {
      const res = await api.updateSubtask(subtaskId, { done: !currentDone });
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              subtasks: res.subtasks,
              subtask_total: res.subtasks.length,
              subtask_done: res.subtasks.filter((s) => s.done).length,
            }
          : prev
      );
      onUpdated();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to update subtask.');
    }
  };

  const handleSaveSubtaskTitle = async (subtaskId: number) => {
    if (!detail || !editingSubtaskTitle.trim()) return;
    try {
      const res = await api.updateSubtask(subtaskId, { title: editingSubtaskTitle.trim() });
      setEditingSubtaskId(null);
      setEditingSubtaskTitle('');
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              subtasks: res.subtasks,
              subtask_total: res.subtasks.length,
              subtask_done: res.subtasks.filter((s) => s.done).length,
            }
          : prev
      );
      onUpdated();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to update subtask title.');
    }
  };

  const handleDeleteSubtask = async (subtaskId: number) => {
    if (!detail) return;
    try {
      const res = await api.deleteSubtask(subtaskId);
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              subtasks: res.subtasks,
              subtask_total: res.subtasks.length,
              subtask_done: res.subtasks.filter((s) => s.done).length,
            }
          : prev
      );
      onUpdated();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to delete subtask.');
    }
  };

  const handleAcceptCompletionSuggestion = async () => {
    if (!detail) return;
    try {
      await api.updateTask(detail.id, { status: 'Completed' });
      const refreshed = await api.getTaskDetail(detail.id);
      setDetail(refreshed);
      populateForm(refreshed);
      onUpdated();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to mark record completed.');
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail || !noteContent.trim()) return;
    try {
      await api.createNote({
        task_id: detail.id,
        title: noteTitle.trim(),
        content: noteContent.trim(),
      });
      setNoteTitle('');
      setNoteContent('');
      await loadDetail(detail.id, true);
      onUpdated();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to add note.');
    }
  };

  const handleDeleteNote = async (noteId: number) => {
    if (!detail) return;
    try {
      await api.deleteNote(noteId);
      await loadDetail(detail.id, true);
      onUpdated();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to delete note.');
    }
  };

  const showCompleteSuggestion = detail
    ? shouldSuggestTaskCompletion(detail.status, detail.subtasks)
    : false;

  const dateFormat = settings?.date_format ?? 'DD/MM/YYYY';
  const timeFormat = settings?.time_format ?? '12h';

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-drawer-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={drawerRef}
        className="w-full max-w-2xl bg-white dark:bg-zinc-900 border-l border-slate-200 dark:border-zinc-800 h-dvh flex flex-col shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 dark:border-zinc-800 shrink-0">
          <div className="min-w-0 pr-2">
            <h2
              id="task-drawer-title"
              className="text-sm sm:text-base font-semibold text-slate-900 dark:text-zinc-100 truncate"
            >
              {detail ? detail.title : 'Record Details'}
            </h2>
            {detail && (
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 truncate">
                {detail.category_name} · Level: {detail.level}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close record details drawer"
            className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200 rounded-md shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
          {error && (
            <div
              role="alert"
              className="p-3 rounded-md bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300"
            >
              {error}
            </div>
          )}

          {savedMsg && (
            <div
              role="status"
              className="p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300"
            >
              {savedMsg}
            </div>
          )}

          {loading || !detail ? (
            <div className="py-12 text-center text-sm text-slate-500">Loading record details…</div>
          ) : (
            <>
              {/* Main Edit Form */}
              <form id="drawer-edit-form" onSubmit={handleSave} className="space-y-3.5 sm:space-y-4">
                <div className="p-3 rounded-md bg-slate-50 dark:bg-zinc-950/60 border border-slate-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="text-slate-500 dark:text-zinc-500 block text-[11px]">
                      Official Syllabus Record
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-zinc-100">
                      {detail.title}
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-slate-500 dark:text-zinc-400">
                    {(detail.category_name || 'Part A').split('—')[0].trim()} · {detail.level}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label
                      htmlFor="drawer-status"
                      className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1"
                    >
                      Status
                    </label>
                    <select
                      id="drawer-status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as TaskStatus)}
                      className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100"
                    >
                      {TASK_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="drawer-priority"
                      className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1"
                    >
                      Priority
                    </label>
                    <select
                      id="drawer-priority"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as TaskPriority)}
                      className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100"
                    >
                      {TASK_PRIORITIES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label
                      htmlFor="drawer-start-date"
                      className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1"
                    >
                      Start Date
                    </label>
                    <input
                      id="drawer-start-date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="drawer-due-date"
                      className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1"
                    >
                      Due Date
                    </label>
                    <input
                      id="drawer-due-date"
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100"
                    />
                    {fieldErrors.due_date && (
                      <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                        {fieldErrors.due_date}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="drawer-notes"
                    className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1"
                  >
                    Record Description / Notes
                  </label>
                  <textarea
                    id="drawer-notes"
                    rows={3}
                    maxLength={10000}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100"
                  />
                  {fieldErrors.notes && (
                    <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                      {fieldErrors.notes}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => populateForm(detail)}
                    className="px-3 py-2 text-xs font-medium text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-md whitespace-nowrap"
                  >
                    Reset Changes
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-md whitespace-nowrap"
                  >
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </form>

              {/* Subtasks Checklist Section */}
              <section className="pt-6 border-t border-slate-200 dark:border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-slate-500" aria-hidden="true" />
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                      Subtasks Checklist
                    </h3>
                  </div>
                  <span className="text-xs text-slate-500 font-mono tabular-nums">
                    {detail.subtasks.filter((s) => s.done).length} / {detail.subtasks.length}{' '}
                    checked
                  </span>
                </div>

                {showCompleteSuggestion && (
                  <div
                    role="region"
                    aria-label="Completion suggestion"
                    className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800"
                  >
                    <div className="flex items-center gap-2 text-xs font-medium text-emerald-800 dark:text-emerald-300">
                      <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>All subtasks are checked. Mark this record completed?</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleAcceptCompletionSuggestion}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md whitespace-nowrap"
                    >
                      Mark Completed
                    </button>
                  </div>
                )}

                <form onSubmit={handleAddSubtask} className="flex gap-2">
                  <input
                    type="text"
                    aria-label="New subtask title"
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    placeholder="Add a checklist item (e.g., Get guide teacher signature)…"
                    maxLength={200}
                    className="flex-1 px-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 dark:bg-zinc-700 hover:bg-slate-800 rounded-md whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Add Subtask</span>
                  </button>
                </form>

                {detail.subtasks.length === 0 ? (
                  <p className="text-xs text-slate-500">No subtasks added for this record yet.</p>
                ) : (
                  <ul className="divide-y divide-slate-200 dark:divide-zinc-800 border border-slate-200 dark:border-zinc-800 rounded-md">
                    {detail.subtasks.map((st) => (
                      <li
                        key={st.id}
                        className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
                      >
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <input
                            type="checkbox"
                            id={`subtask-check-${st.id}`}
                            checked={st.done}
                            onChange={() => handleToggleSubtask(st.id, st.done)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          {editingSubtaskId === st.id ? (
                            <div className="flex items-center gap-1.5 flex-1">
                              <input
                                type="text"
                                aria-label="Edit subtask title"
                                value={editingSubtaskTitle}
                                onChange={(e) => setEditingSubtaskTitle(e.target.value)}
                                className="flex-1 px-2 py-1 text-xs rounded border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveSubtaskTitle(st.id)}
                                className="px-2 py-1 text-xs font-medium text-white bg-blue-600 rounded"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingSubtaskId(null)}
                                className="px-2 py-1 text-xs text-slate-500"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <label
                              htmlFor={`subtask-check-${st.id}`}
                              className={`truncate cursor-pointer ${
                                st.done
                                  ? 'line-through text-slate-400 dark:text-zinc-500'
                                  : 'text-slate-800 dark:text-zinc-200'
                              }`}
                            >
                              {st.title}
                            </label>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {editingSubtaskId !== st.id && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingSubtaskId(st.id);
                                setEditingSubtaskTitle(st.title);
                              }}
                              className="text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200"
                            >
                              Edit
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteSubtask(st.id)}
                            aria-label={`Delete subtask ${st.title}`}
                            className="text-rose-600 hover:text-rose-700"
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Task Notes Section */}
              <section className="pt-6 border-t border-slate-200 dark:border-zinc-800 space-y-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-500" aria-hidden="true" />
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                    Record Notes ({detail.task_notes.length})
                  </h3>
                </div>

                <form onSubmit={handleAddNote} className="space-y-2">
                  <input
                    type="text"
                    aria-label="New note title"
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    placeholder="Note heading (optional)"
                    className="w-full px-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                  />
                  <div className="flex gap-2">
                    <textarea
                      rows={2}
                      aria-label="New note content"
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      placeholder="Write a note for this record…"
                      className="flex-1 px-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                    />
                    <button
                      type="submit"
                      className="self-end px-3 py-1.5 text-xs font-medium text-white bg-slate-900 dark:bg-zinc-700 hover:bg-slate-800 rounded-md whitespace-nowrap"
                    >
                      Add Note
                    </button>
                  </div>
                </form>

                {detail.task_notes.length > 0 && (
                  <div className="space-y-2">
                    {detail.task_notes.map((n) => (
                      <div
                        key={n.id}
                        className="p-3 rounded-md border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-800/30 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900 dark:text-zinc-100">
                            {n.title || 'Note'}
                          </span>
                          <div className="flex items-center gap-2 text-slate-500">
                            <span className="tabular-nums">
                              {formatUtcTimestampLocal(n.updated_at, dateFormat, timeFormat)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteNote(n.id)}
                              className="text-rose-600 hover:underline"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        <p className="text-slate-700 dark:text-zinc-300 whitespace-pre-wrap">
                          {n.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Task Activity History Section */}
              <section className="pt-6 border-t border-slate-200 dark:border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-slate-500" aria-hidden="true" />
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                      Record History ({detail.activity.length})
                    </h3>
                  </div>
                </div>

                {detail.activity.length === 0 ? (
                  <p className="text-xs text-slate-500">No activity recorded yet.</p>
                ) : (
                  <ul className="space-y-2 text-xs">
                    {detail.activity.map((act) => (
                      <li
                        key={act.id}
                        className="flex items-center justify-between gap-4 py-1.5 border-b border-slate-100 dark:border-zinc-800/60 last:border-0"
                      >
                        <div className="text-slate-700 dark:text-zinc-300">
                          <span className="font-medium">{act.action.replace(/_/g, ' ')}</span>
                          {act.from_value || act.to_value ? (
                            <span className="text-slate-500">
                              {' '}
                              · {act.from_value ? `${act.from_value} → ` : ''}
                              {act.to_value}
                            </span>
                          ) : null}
                        </div>
                        <span className="text-slate-400 font-mono tabular-nums shrink-0">
                          {formatUtcTimestampLocal(act.created_at, dateFormat, timeFormat)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
