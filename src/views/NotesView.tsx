import React, { useCallback, useEffect, useState } from 'react';
import { FileText, Plus, Search, Trash2, Edit3 } from 'lucide-react';
import type { AppSettings, Task, TaskNote } from '../shared/constants.ts';
import { formatUtcTimestampLocal } from '../shared/stats.ts';
import { api, ApiClientError } from '../api/client.ts';

interface NotesViewProps {
  settings: AppSettings | null;
  dataVersion: number;
  onOpenTaskDetail: (taskId: number) => void;
}

export function NotesView({ settings, dataVersion, onOpenTaskDetail }: NotesViewProps) {
  const [notes, setNotes] = useState<TaskNote[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [filterScope, setFilterScope] = useState<string>('all'); // 'all' | 'general' | '<taskId>'
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [newTaskId, setNewTaskId] = useState<string>('general');
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editTaskId, setEditTaskId] = useState<string>('general');
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const dateFormat = settings?.date_format ?? 'DD/MM/YYYY';
  const timeFormat = settings?.time_format ?? '12h';

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [notesRes, tasksRes] = await Promise.all([
        api.getNotes({
          taskId: filterScope !== 'all' ? filterScope : undefined,
          search: search.trim() || undefined,
        }),
        api.getTasks({ pageSize: 100 }),
      ]);
      setNotes(notesRes);
      setAllTasks(tasksRes.items);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to load notes.');
    } finally {
      setLoading(false);
    }
  }, [filterScope, search, dataVersion]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.createNote({
        task_id: newTaskId === 'general' ? null : Number(newTaskId),
        title: newTitle.trim(),
        content: newContent.trim(),
      });
      setNewTitle('');
      setNewContent('');
      await loadData();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to create note.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEdit = async (id: number) => {
    if (!editContent.trim()) return;
    setError(null);
    try {
      await api.updateNote(id, {
        task_id: editTaskId === 'general' ? null : Number(editTaskId),
        title: editTitle.trim(),
        content: editContent.trim(),
      });
      setEditingId(null);
      await loadData();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to update note.');
    }
  };

  const handleDelete = async (id: number) => {
    setError(null);
    try {
      await api.deleteNote(id);
      setConfirmDeleteId(null);
      await loadData();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to delete note.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100">
          Semester & Record Notes
        </h1>
        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
          Maintain general Semester III notes (internship school details, guide teacher instructions)
          alongside notes linked to individual practical records.
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

      {/* Create Note Card */}
      <section className="p-5 rounded-lg bg-white dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 mb-3">
          Add New Note
        </h2>
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="note-create-title"
                className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1"
              >
                Title (optional)
              </label>
              <input
                id="note-create-title"
                type="text"
                maxLength={200}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g., Cooperative School Internship Schedule"
                className="w-full px-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100"
              />
            </div>

            <div>
              <label
                htmlFor="note-create-scope"
                className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1"
              >
                Attached To
              </label>
              <select
                id="note-create-scope"
                value={newTaskId}
                onChange={(e) => setNewTaskId(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100"
              >
                <option value="general">General Semester Note (No specific record)</option>
                {allTasks.map((t) => (
                  <option key={t.id} value={String(t.id)}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="note-create-content"
              className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1"
            >
              Note Content <span className="text-rose-600">*</span>
            </label>
            <textarea
              id="note-create-content"
              rows={3}
              required
              maxLength={10000}
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Write your note here…"
              className="w-full px-3 py-2 text-xs rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting || !newContent.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-md whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{submitting ? 'Saving…' : 'Save Note'}</span>
            </button>
          </div>
        </form>
      </section>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg bg-white dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="notes-filter-scope" className="text-xs font-medium text-slate-600 dark:text-zinc-400">
            Filter:
          </label>
          <select
            id="notes-filter-scope"
            value={filterScope}
            onChange={(e) => setFilterScope(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100"
          >
            <option value="all">All Notes (General + Record Notes)</option>
            <option value="general">General Semester Notes Only</option>
            {allTasks.map((t) => (
              <option key={t.id} value={String(t.id)}>
                Record: {t.title}
              </option>
            ))}
          </select>
        </div>

        <div className="relative w-full sm:w-64">
          <Search
            className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            aria-label="Search notes"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes…"
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
          />
        </div>
      </div>

      {/* Notes List */}
      {loading ? (
        <div className="p-8 text-center text-xs text-slate-500 dark:text-zinc-400 bg-white dark:bg-zinc-900/90 rounded-lg border border-slate-200 dark:border-zinc-800">
          Loading notes…
        </div>
      ) : notes.length === 0 ? (
        <div className="p-10 text-center bg-white dark:bg-zinc-900/90 rounded-lg border border-slate-200 dark:border-zinc-800 space-y-2">
          <FileText className="w-8 h-8 text-slate-300 dark:text-zinc-700 mx-auto" aria-hidden="true" />
          <p className="text-sm font-medium text-slate-800 dark:text-zinc-200">No notes yet</p>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Use the form above to add a general semester note or attach a note to a practical record.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <article
              key={note.id}
              className="p-5 rounded-lg bg-white dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800 space-y-3"
            >
              {editingId === note.id ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      aria-label="Edit note title"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Note title"
                      className="px-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                    />
                    <select
                      aria-label="Edit note record link"
                      value={editTaskId}
                      onChange={(e) => setEditTaskId(e.target.value)}
                      className="px-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                    >
                      <option value="general">General Semester Note</option>
                      {allTasks.map((t) => (
                        <option key={t.id} value={String(t.id)}>
                          {t.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    rows={3}
                    aria-label="Edit note content"
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1.5 text-xs bg-slate-100 dark:bg-zinc-800 rounded-md"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(note.id)}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                    >
                      Save Note
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                        {note.title || 'Untitled Note'}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                        {note.task_id ? (
                          <button
                            type="button"
                            onClick={() => onOpenTaskDetail(note.task_id!)}
                            className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                          >
                            Record: {note.task_title || `#${note.task_id}`}
                          </button>
                        ) : (
                          <span>General Semester Note</span>
                        )}
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {formatUtcTimestampLocal(note.updated_at, dateFormat, timeFormat)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(note.id);
                          setEditTitle(note.title);
                          setEditContent(note.content);
                          setEditTaskId(note.task_id ? String(note.task_id) : 'general');
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded"
                      >
                        <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Edit</span>
                      </button>

                      {confirmDeleteId === note.id ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDelete(note.id)}
                            className="px-2.5 py-1 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 rounded"
                          >
                            Confirm Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1 text-xs text-slate-500"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(note.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                    {note.content}
                  </p>
                </>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
