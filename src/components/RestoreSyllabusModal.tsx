import React, { useEffect, useState } from 'react';
import { RotateCcw, X } from 'lucide-react';
import type { RestoreSyllabusPreview } from '../shared/constants.ts';
import { api, ApiClientError } from '../api/client.ts';
import { useFocusTrap } from '../hooks/useFocusTrap.ts';

interface RestoreSyllabusModalProps {
  open: boolean;
  onClose: () => void;
  onRestored: () => void;
}

export function RestoreSyllabusModal({ open, onClose, onRestored }: RestoreSyllabusModalProps) {
  const modalRef = useFocusTrap<HTMLDivElement>(open);
  const [preview, setPreview] = useState<RestoreSyllabusPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoadingPreview(true);
    setError(null);
    api
      .previewRestoreSyllabus()
      .then((data) => {
        setPreview(data);
      })
      .catch((err) => {
        setError(err instanceof ApiClientError ? err.message : 'Failed to load syllabus preview.');
      })
      .finally(() => {
        setLoadingPreview(false);
      });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleConfirm = async () => {
    setExecuting(true);
    setError(null);
    try {
      await api.restoreSyllabus();
      onRestored();
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Restore failed.');
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-[1px] p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="restore-syllabus-title"
    >
      <div
        ref={modalRef}
        className="w-full max-w-lg max-h-[92dvh] sm:max-h-[90vh] flex flex-col rounded-t-xl sm:rounded-lg bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            <h2
              id="restore-syllabus-title"
              className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              Restore Original Syllabus
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Restore Original Syllabus dialog"
            className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 text-sm text-slate-700 dark:text-slate-300">
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Matches the 20 seeded B.Ed. Semester III practical records by{' '}
            <code className="font-mono text-xs">seed_key</code>. It re-creates missing seeded
            records and un-archives archived seeded records. It{' '}
            <strong>never overwrites edits</strong> to existing records and never touches custom
            records, notes, subtasks, history, or focus sessions.
          </p>

          {error && (
            <div
              role="alert"
              className="p-3 rounded-md bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300"
            >
              {error}
            </div>
          )}

          {loadingPreview ? (
            <div className="py-6 text-center text-xs text-slate-500">
              Checking syllabus records…
            </div>
          ) : preview ? (
            preview.total_to_restore === 0 ? (
              <div className="p-4 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300">
                All 20 original seeded syllabus records and 4 categories are currently active.
                Nothing needs to be restored.
              </div>
            ) : (
              <div className="space-y-3">
                {preview.archived_tasks.length > 0 && (
                  <div className="p-3 rounded-md bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 mb-1.5">
                      Archived seeded records to un-archive ({preview.archived_tasks.length}):
                    </p>
                    <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300 list-disc pl-4">
                      {preview.archived_tasks.map((t) => (
                        <li key={t.seed_key}>
                          {t.title} <span className="text-slate-500">· {t.part}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {preview.missing_tasks.length > 0 && (
                  <div className="p-3 rounded-md bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 mb-1.5">
                      Permanently deleted seeded records to re-create ({preview.missing_tasks.length}
                      ):
                    </p>
                    <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300 list-disc pl-4">
                      {preview.missing_tasks.map((t) => (
                        <li key={t.seed_key}>
                          {t.title} <span className="text-slate-500">· {t.part}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loadingPreview || executing || !preview || preview.total_to_restore === 0}
            onClick={handleConfirm}
            className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-md whitespace-nowrap"
          >
            {executing
              ? 'Restoring…'
              : `Confirm Restore (${preview?.total_to_restore ?? 0})`}
          </button>
        </div>
      </div>
    </div>
  );
}
