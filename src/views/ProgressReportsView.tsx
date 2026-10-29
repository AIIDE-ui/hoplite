import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Award, BookOpen, CheckCircle2, Clock, ListChecks, TriangleAlert } from 'lucide-react';
import type { AppSettings, SyllabusOverviewResponse, Task } from '../shared/constants.ts';
import { api, ApiClientError } from '../api/client.ts';
import {
  formatMinutesHuman,
  formatUtcTimestampLocal,
  getLocalTodayYMD,
} from '../shared/stats.ts';
import { buildProgressReport, getReportPartKey } from '../shared/progressReport.ts';

interface ProgressReportsViewProps {
  settings: AppSettings | null;
  syllabus: SyllabusOverviewResponse | null;
  dataVersion: number;
  onOpenTaskDetail: (taskId: number) => void;
  onNavigateSubtasks: () => void;
}

const PART_SHORT = { part_a: 'Part A', part_b: 'Part B', part_c: 'Part C', custom: 'Custom' };
const cardClass =
  'p-5 rounded-lg bg-white dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800';

function formatNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function Bar({ pct, label }: { pct: number; label: string }) {
  return (
    <div
      className="w-full h-2 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className="h-full bg-emerald-500 transition-all duration-200"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function ProgressReportsView({
  settings,
  syllabus,
  dataVersion,
  onOpenTaskDetail,
  onNavigateSubtasks,
}: ProgressReportsViewProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const dateFormat = settings?.date_format ?? 'DD/MM/YYYY';
  const timeFormat = settings?.time_format ?? '12h';

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.getTasks({ pageSize: 200, sort: 'manual' });
      setTasks(res.items);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Unable to load your report.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, dataVersion]);

  const report = useMemo(() => buildProgressReport(tasks, getLocalTodayYMD()), [tasks]);
  const swayam = syllabus?.parts.find((p) => p.part === 'Part C') ?? null;
  const partRows = report.parts.filter(
    (p) => p.key === 'part_a' || p.key === 'part_b' || p.total > 0
  );

  if (loading) {
    return <p className="text-xs text-slate-500">Loading your progress report…</p>;
  }

  const ringStyle = {
    background: `conic-gradient(rgb(16 185 129) ${report.completion_percentage * 3.6}deg, rgb(148 163 184 / 0.25) 0deg)`,
  };

  const tiles = [
    { label: 'Completed', value: report.completed, icon: CheckCircle2, tone: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'In Progress', value: report.in_progress, icon: Clock, tone: 'text-blue-600 dark:text-blue-400' },
    { label: 'Not Started', value: report.not_started, icon: BookOpen, tone: 'text-slate-500 dark:text-zinc-400' },
    { label: 'Overdue', value: report.overdue, icon: TriangleAlert, tone: report.overdue > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-zinc-400' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100">Progress Reports</h1>
        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
          Your personal Semester III report: how much is finished, part by part, and every record
          you have completed so far.
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

      {/* Overall */}
      <section aria-labelledby="report-overall" className={cardClass}>
        <h2 id="report-overall" className="sr-only">
          Overall completion
        </h2>
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex items-center gap-5">
            <div
              className="relative w-28 h-28 shrink-0 rounded-full"
              style={ringStyle}
              role="img"
              aria-label={`${report.completion_percentage}% of records completed`}
            >
              <div className="absolute inset-2.5 rounded-full bg-white dark:bg-zinc-900 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold tabular-nums text-slate-900 dark:text-zinc-100">
                  {report.completion_percentage}%
                </span>
                <span className="text-[10px] uppercase tracking-wide text-slate-500">complete</span>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                {report.completed} of {report.total} records completed
              </p>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                {report.total - report.completed === 0
                  ? 'Every record is finished. Well done!'
                  : `${report.total - report.completed} still to finish this semester.`}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
            {tiles.map((tile) => {
              const Icon = tile.icon;
              return (
                <div
                  key={tile.label}
                  className="p-3 rounded-md border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/60"
                >
                  <p className={`flex items-center gap-1.5 text-[11px] font-medium ${tile.tone}`}>
                    <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                    {tile.label}
                  </p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-slate-900 dark:text-zinc-100">
                    {tile.value}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <dl className="mt-5 pt-4 border-t border-slate-100 dark:border-zinc-800 grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div>
            <dt className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400">
              <Award className="w-3.5 h-3.5" aria-hidden="true" />
              Credits finished
            </dt>
            <dd className="mt-0.5 font-semibold tabular-nums text-slate-900 dark:text-zinc-100">
              {formatNum(report.credits_completed)} of {formatNum(report.credits_total)}
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400">
              <Award className="w-3.5 h-3.5" aria-hidden="true" />
              Marks finished
            </dt>
            <dd className="mt-0.5 font-semibold tabular-nums text-slate-900 dark:text-zinc-100">
              {formatNum(report.marks_completed)} of {formatNum(report.marks_total)}
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400">
              <ListChecks className="w-3.5 h-3.5" aria-hidden="true" />
              Checklist steps ticked
            </dt>
            <dd className="mt-0.5 font-semibold tabular-nums text-slate-900 dark:text-zinc-100">
              {report.subtasks_done} of {report.subtasks_total}
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400">
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              Time spent on records
            </dt>
            <dd className="mt-0.5 font-semibold tabular-nums text-slate-900 dark:text-zinc-100">
              {formatMinutesHuman(report.time_spent_minutes)}
            </dd>
          </div>
        </dl>
      </section>

      {/* By part */}
      <section aria-labelledby="report-parts" className={cardClass}>
        <h2 id="report-parts" className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
          Progress by part
        </h2>
        <div className="mt-4 space-y-4">
          {partRows.map((p) => (
            <div key={p.key} className="space-y-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-xs">
                <span className="font-medium text-slate-800 dark:text-zinc-200">{p.label}</span>
                <span className="font-mono tabular-nums text-slate-600 dark:text-zinc-400">
                  {p.completed}/{p.total} done · {formatNum(p.credits_completed)}/
                  {formatNum(p.credits_total)} credits · {p.completion_percentage}%
                </span>
              </div>
              <Bar pct={p.completion_percentage} label={`${p.label} completion`} />
            </div>
          ))}
          {swayam && (
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-md border border-slate-200 dark:border-zinc-800 text-xs">
              <span className="font-medium text-slate-800 dark:text-zinc-200">
                Part C — Online Course (SWAYAM) · course status
              </span>
              <span
                className={`font-semibold ${
                  swayam.course_status === 'Completed'
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : swayam.course_status === 'In Progress'
                      ? 'text-blue-700 dark:text-blue-400'
                      : 'text-slate-600 dark:text-zinc-400'
                }`}
              >
                {swayam.course_status ?? 'Not Started'}
              </span>
            </div>
          )}
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-slate-500 dark:text-zinc-400">
          Credits and marks are the values of the records you track. The SWAYAM course status is
          not counted in record completion.
          {syllabus &&
            ` Official totals: ${syllabus.parts
              .map((part) => `${part.part} ${formatNum(part.official_credits)} credit${part.official_credits === 1 ? '' : 's'} / ${formatNum(part.official_marks)} marks`)
              .join(' · ')}.`}
        </p>
      </section>

      {/* Finished records */}
      <section aria-labelledby="report-finished" className={cardClass}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="report-finished" className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
            Finished records ({report.finished.length})
          </h2>
          <span className="text-[11px] text-slate-500">Most recently finished first</span>
        </div>

        {report.finished.length === 0 ? (
          <div className="mt-4 p-4 rounded-md border border-dashed border-slate-300 dark:border-zinc-700 text-xs text-slate-600 dark:text-zinc-400 space-y-2">
            <p>No finished records yet. When you mark a record Completed, it appears here.</p>
            <button
              type="button"
              onClick={onNavigateSubtasks}
              className="font-medium text-blue-700 dark:text-blue-400 hover:underline"
            >
              Plan your steps in the Subtask Manager →
            </button>
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-xs">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-200 dark:border-zinc-800">
                  <th scope="col" className="py-2 pr-3 font-medium">Record</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Part</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Finished on</th>
                  <th scope="col" className="py-2 pr-3 font-medium text-right">Credits / Marks</th>
                  <th scope="col" className="py-2 pr-3 font-medium text-right">Steps</th>
                  <th scope="col" className="py-2 font-medium text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {report.finished.map((t) => (
                  <tr key={t.id}>
                    <td className="py-2.5 pr-3">
                      <button
                        type="button"
                        onClick={() => onOpenTaskDetail(t.id)}
                        className="text-left font-medium text-slate-800 dark:text-zinc-200 hover:text-blue-700 dark:hover:text-blue-400 hover:underline"
                      >
                        {t.title}
                      </button>
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap text-slate-600 dark:text-zinc-400">
                      {PART_SHORT[getReportPartKey(t.category_seed_key)]}
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap text-slate-600 dark:text-zinc-400">
                      {t.completed_at
                        ? formatUtcTimestampLocal(t.completed_at, dateFormat, timeFormat).split(',')[0]
                        : '—'}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-slate-700 dark:text-zinc-300">
                      {formatNum(t.credits)} / {formatNum(t.marks)}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-slate-700 dark:text-zinc-300">
                      {t.subtask_total === 0 ? '—' : `${t.subtask_done}/${t.subtask_total}`}
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums text-slate-700 dark:text-zinc-300">
                      {formatMinutesHuman(t.time_spent_minutes)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
