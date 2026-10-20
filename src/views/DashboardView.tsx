import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { ArrowRight, BookOpen, Calendar } from 'lucide-react';
import {
  COURSE_STATUSES,
  type AppSettings,
  type CourseStatus,
  type DashboardSummary,
  type StudentProfile,
  type TaskActivity,
} from '../shared/constants.ts';
import {
  formatPlainDate,
  formatUtcTimestampLocal,
  isTaskOverdue,
} from '../shared/stats.ts';
import { StatusText } from '../components/StatusIndicator.tsx';
import { api } from '../api/client.ts';

interface DashboardViewProps {
  profile: StudentProfile | null;
  settings: AppSettings | null;
  summary: DashboardSummary | null;
  activity: TaskActivity[];
  loading: boolean;
  onNavigateRecords: (filters: Record<string, string>) => void;
  onOpenTaskDetail: (taskId: number) => void;
  onRefresh: () => Promise<void>;
}

export function DashboardView({
  profile,
  settings,
  summary,
  activity,
  loading,
  onNavigateRecords,
  onOpenTaskDetail,
  onRefresh,
}: DashboardViewProps) {
  const [updatingCourseStatus, setUpdatingCourseStatus] = useState(false);

  if (loading || !summary) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <div className="h-20 rounded-lg bg-slate-200/60 dark:bg-zinc-900 animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div
              key={idx}
              className="h-24 rounded-lg bg-slate-200/60 dark:bg-zinc-900 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  const studentName = profile?.name?.trim();
  const greetingText = studentName ? `Hello, ${studentName}` : 'Welcome';
  const dateFormat = settings?.date_format ?? 'DD/MM/YYYY';
  const timeFormat = settings?.time_format ?? '12h';
  const isDark = (settings?.theme ?? 'dark') === 'dark';

  const partC = summary.syllabus.parts.find((p) => p.part === 'Part C');

  const handleCourseStatusChange = async (nextStatus: CourseStatus) => {
    setUpdatingCourseStatus(true);
    try {
      await api.updateSyllabusPart('Part C', { course_status: nextStatus });
      await onRefresh();
    } finally {
      setUpdatingCourseStatus(false);
    }
  };

  const kpiCards: Array<{
    label: string;
    value: number;
    sub: string;
    filter: Record<string, string>;
    accent: string;
    spanMobile?: boolean;
  }> = [
    {
      label: 'Total Records',
      value: summary.total,
      sub: 'Official practical records',
      filter: {},
      accent: 'text-slate-900 dark:text-zinc-100',
      spanMobile: true,
    },
    {
      label: 'Completed',
      value: summary.completed,
      sub: `${summary.completion_percentage}% completion`,
      filter: { status: 'Completed' },
      accent: 'text-emerald-700 dark:text-emerald-400',
    },
    {
      label: 'In Progress',
      value: summary.in_progress,
      sub: 'Currently active',
      filter: { status: 'In Progress' },
      accent: 'text-blue-700 dark:text-blue-400',
    },
    {
      label: 'Pending',
      value: summary.pending,
      sub: 'Not Started',
      filter: { status: 'Not Started' },
      accent: 'text-slate-700 dark:text-zinc-300',
    },
    {
      label: 'Overdue',
      value: summary.overdue,
      sub: 'Past due date',
      filter: { due: 'overdue' },
      accent:
        summary.overdue > 0
          ? 'text-rose-700 dark:text-rose-400'
          : 'text-slate-700 dark:text-zinc-300',
    },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Greeting & Overall Progress Header */}
      <section className="p-4 sm:p-6 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs text-slate-500 dark:text-zinc-400">
              <span>{profile?.university || 'TNTEU'}</span>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-slate-700 dark:text-zinc-300">
                B.Ed. 3rd Semester
              </span>
              <span aria-hidden="true">·</span>
              <span>{profile?.syllabus_pattern || 'CBCS 2021–2022'}</span>
              {profile?.roll_number ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">Roll: {profile.roll_number}</span>
                </>
              ) : null}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
              {greetingText}
            </h1>
            <p className="text-xs text-slate-600 dark:text-zinc-400">
              Track your Semester III Teaching Competency, Practical Records, EPC Records, and
              SWAYAM Online Course.
            </p>
          </div>
        </div>

        {/* Overall Progress Bar */}
        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-zinc-800">
          <div className="flex flex-wrap items-center justify-between gap-1 text-xs mb-2">
            <span className="font-medium text-slate-700 dark:text-zinc-300">
              Overall Practical Record Completion
            </span>
            <span className="font-mono font-semibold text-slate-900 dark:text-zinc-100 tabular-nums">
              {summary.completed} of {summary.total} records completed (
              {summary.completion_percentage}%)
            </span>
          </div>
          <div
            className="w-full h-2 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={summary.completion_percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Overall Practical Record Completion"
          >
            <div
              className="h-full bg-emerald-500 transition-all duration-200"
              style={{ width: `${summary.completion_percentage}%` }}
            />
          </div>
        </div>
      </section>

      {/* 5 Interactive Stat Cards */}
      <section aria-label="Record Summary Statistics">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {kpiCards.map((card) => (
            <button
              key={card.label}
              type="button"
              onClick={() => onNavigateRecords(card.filter)}
              className={`group text-left p-3.5 sm:p-4 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${
                card.spanMobile ? 'col-span-2 sm:col-span-1' : ''
              }`}
            >
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
                <span>{card.label}</span>
                <ArrowRight
                  className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-slate-700 dark:text-zinc-200"
                  aria-hidden="true"
                />
              </div>
              <div
                className={`mt-1.5 sm:mt-2 text-2xl font-bold font-mono tabular-nums ${card.accent}`}
              >
                {card.value}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-zinc-400 truncate">
                {card.sub}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Chart + Upcoming/Overdue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-stretch">
        {/* Status by Category Chart */}
        <section className="lg:col-span-7 p-4 sm:p-6 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100">
                Record Status by Syllabus Part
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Breakdown of Completed, In Progress, and Not Started records per syllabus part
              </p>
            </div>
          </div>

          <div className="flex-1 min-h-[240px] sm:min-h-[260px] w-full">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart
                data={summary.by_category}
                margin={{ top: 10, right: 12, left: -16, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={isDark ? '#27272a' : '#e2e8f0'}
                  vertical={false}
                />
                <XAxis
                  dataKey="short_name"
                  tick={{ fontSize: 11, fill: isDark ? '#a1a1aa' : '#64748b' }}
                  axisLine={{ stroke: isDark ? '#3f3f46' : '#cbd5e1' }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: isDark ? '#a1a1aa' : '#64748b' }}
                  axisLine={{ stroke: isDark ? '#3f3f46' : '#cbd5e1' }}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: '12px',
                    borderRadius: '6px',
                    backgroundColor: isDark ? '#18181b' : '#ffffff',
                    border: isDark ? '1px solid #27272a' : '1px solid #cbd5e1',
                    color: isDark ? '#f4f4f5' : '#0f172a',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="completed" name="Completed" stackId="a" fill="#10b981" />
                <Bar dataKey="in_progress" name="In Progress" stackId="a" fill="#3b82f6" />
                <Bar dataKey="not_started" name="Not Started" stackId="a" fill="#52525b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Upcoming & Overdue Panel */}
        <section className="lg:col-span-5 p-4 sm:p-6 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100">
                Upcoming & Active Records
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Records with upcoming/overdue due dates or currently in progress
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateRecords({})}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap shrink-0"
            >
              View All
            </button>
          </div>

          {summary.upcoming_and_overdue.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
              <Calendar
                className="w-8 h-8 text-slate-300 dark:text-zinc-700 mb-2"
                aria-hidden="true"
              />
              <p className="text-xs text-slate-600 dark:text-zinc-400">
                No due dates or active records scheduled yet.
              </p>
              <button
                type="button"
                onClick={() => onNavigateRecords({})}
                className="mt-3 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                Assign due dates in Records →
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-zinc-800">
              {summary.upcoming_and_overdue.map((task) => {
                const overdue = isTaskOverdue(task.due_date, task.status, summary.today);
                return (
                  <li key={task.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => onOpenTaskDetail(task.id)}
                        className="text-xs font-medium text-slate-900 dark:text-zinc-100 hover:text-blue-600 dark:hover:text-blue-400 truncate block text-left"
                      >
                        {task.title}
                      </button>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                        <StatusText status={task.status} />
                        {task.category_name && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="truncate">{task.category_name}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {task.due_date ? (
                        <span
                          className={`text-xs font-mono tabular-nums ${
                            overdue
                              ? 'text-rose-600 dark:text-rose-400 font-semibold'
                              : 'text-slate-600 dark:text-zinc-400'
                          }`}
                        >
                          {overdue ? 'Overdue · ' : 'Due '}
                          {formatPlainDate(task.due_date, dateFormat)}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-zinc-500">No due date</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Syllabus Overview + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
        {/* Syllabus Overview Panel */}
        <section className="lg:col-span-7 p-4 sm:p-6 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-slate-500 dark:text-zinc-400 shrink-0" aria-hidden="true" />
              <h2 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-zinc-100">
                Syllabus Overview (TNTEU B.Ed. Semester III)
              </h2>
            </div>
            <span className="text-xs text-slate-500 dark:text-zinc-400 font-mono tabular-nums">
              Official: {summary.syllabus.official_totals.credits} cr /{' '}
              {summary.syllabus.official_totals.marks} marks
            </span>
          </div>

          {/* Mobile Dynamic Stack Cards (< md) */}
          <div className="space-y-3 md:hidden">
            {summary.syllabus.parts.map((part) => (
              <div
                key={part.part}
                className="p-3.5 rounded-md border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/50 space-y-2 text-xs"
              >
                <div className="font-semibold text-slate-900 dark:text-zinc-100">
                  {part.title}
                </div>
                {part.part === 'Part C' && (
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    SWAYAM Online Course — online course, not a practical record
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-200/70 dark:border-zinc-800">
                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-zinc-500 block">
                      Official Total
                    </span>
                    <span className="font-mono font-medium text-slate-900 dark:text-zinc-100 tabular-nums">
                      {part.official_credits} cr / {part.official_marks} marks
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-slate-500 dark:text-zinc-500 block">
                      Tracked
                    </span>
                    <span className="font-mono font-medium text-slate-700 dark:text-zinc-300 tabular-nums">
                      {part.completed_task_count} / {part.tracked_task_count} done
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table (>= md) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400">
                  <th className="py-2 pr-3 font-medium">Syllabus Component</th>
                  <th className="py-2 px-3 font-medium text-right">Official Total</th>
                  <th className="py-2 pl-3 font-medium text-right">Tracked Records</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {summary.syllabus.parts.map((part) => (
                  <tr key={part.part} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40">
                    <td className="py-3 pr-3">
                      <div className="font-medium text-slate-900 dark:text-zinc-100">
                        {part.title}
                      </div>
                      {part.part === 'Part C' && (
                        <div className="text-slate-500 dark:text-zinc-400 mt-0.5">
                          SWAYAM Online Course — online course, not a practical record
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-900 dark:text-zinc-100 whitespace-nowrap">
                      {part.official_credits} cr / {part.official_marks} marks
                    </td>
                    <td className="py-3 pl-3 text-right font-mono tabular-nums text-slate-700 dark:text-zinc-300 whitespace-nowrap">
                      {part.completed_task_count} / {part.tracked_task_count} done
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Part C Course Status Selector */}
          {partC && (
            <div className="p-3.5 sm:p-4 rounded-md bg-slate-50 dark:bg-zinc-950/60 border border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-xs font-semibold text-slate-900 dark:text-zinc-100">
                  Part C — Online Course (SWAYAM)
                </h3>
                <p className="text-xs text-slate-600 dark:text-zinc-400 mt-0.5">
                  SWAYAM Online Course — {partC.official_credits} credit / {partC.official_marks}{' '}
                  marks (official). An online course, not a practical record.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 shrink-0">
                <label
                  htmlFor="dashboard-part-c-status"
                  className="text-xs font-medium text-slate-700 dark:text-zinc-300"
                >
                  Course status (not counted in record progress):
                </label>
                <select
                  id="dashboard-part-c-status"
                  disabled={updatingCourseStatus}
                  value={partC.course_status ?? 'Not Started'}
                  onChange={(e) => handleCourseStatusChange(e.target.value as CourseStatus)}
                  className="w-full sm:w-auto px-2.5 py-1.5 text-xs font-medium rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100"
                >
                  {COURSE_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Teaching Competency Note */}
          <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 text-xs text-slate-600 dark:text-zinc-400">
            <p>
              <strong>Note:</strong> {summary.syllabus.teaching_competency_note}
            </p>
          </div>
        </section>

        {/* Recent Activity Feed */}
        <section className="lg:col-span-5 p-4 sm:p-6 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100">
              Recent Activity
            </h2>
            <span className="text-xs text-slate-500 dark:text-zinc-400 font-mono tabular-nums">
              Latest {activity.length} events
            </span>
          </div>

          {activity.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-zinc-400 py-6 text-center">
              No recent activity yet.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-zinc-800 text-xs max-h-[380px] overflow-y-auto">
              {activity.map((item) => (
                <li key={item.id} className="py-2.5 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900 dark:text-zinc-100 truncate">
                      {item.task_title || 'System'}
                    </div>
                    <div className="text-slate-600 dark:text-zinc-400 mt-0.5">
                      <span>{item.action.replace(/_/g, ' ')}</span>
                      {item.from_value || item.to_value ? (
                        <span>
                          {' '}
                          · {item.from_value ? `${item.from_value} → ` : ''}
                          {item.to_value}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <span className="text-slate-400 dark:text-zinc-500 font-mono tabular-nums shrink-0 text-[11px]">
                    {formatUtcTimestampLocal(item.created_at, dateFormat, timeFormat)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
