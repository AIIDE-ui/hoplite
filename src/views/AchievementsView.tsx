import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Award,
  BookOpen,
  CalendarCheck,
  Clock,
  Crown,
  Flag,
  Footprints,
  GraduationCap,
  Layers,
  ListChecks,
  Lock,
  Rocket,
  Target,
  Trophy,
} from 'lucide-react';
import type { AppSettings, SyllabusOverviewResponse, Task } from '../shared/constants.ts';
import { api, ApiClientError } from '../api/client.ts';
import { calculateCompletionPercentage, formatUtcTimestampLocal } from '../shared/stats.ts';
import {
  computeAchievements,
  nextAchievement,
  type Achievement,
  type AchievementId,
} from '../shared/achievements.ts';

type BadgeTarget = 'records' | 'subtasks' | 'dashboard';

interface AchievementsViewProps {
  settings: AppSettings | null;
  syllabus: SyllabusOverviewResponse | null;
  dataVersion: number;
  onNavigate: (page: BadgeTarget) => void;
}

type IconType = React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>;

const BADGE_STYLE: Record<AchievementId, { icon: IconType; tone: string; target: BadgeTarget }> = {
  first_record: { icon: Footprints, tone: 'from-sky-400 to-blue-600', target: 'records' },
  five_records: { icon: Rocket, tone: 'from-violet-400 to-purple-600', target: 'records' },
  halfway: { icon: Flag, tone: 'from-teal-400 to-emerald-600', target: 'records' },
  level_1: { icon: Layers, tone: 'from-cyan-400 to-sky-600', target: 'records' },
  level_2: { icon: Layers, tone: 'from-indigo-400 to-indigo-600', target: 'records' },
  part_a: { icon: Trophy, tone: 'from-amber-300 to-amber-600', target: 'records' },
  part_b: { icon: BookOpen, tone: 'from-lime-400 to-green-600', target: 'records' },
  swayam: { icon: GraduationCap, tone: 'from-rose-400 to-pink-600', target: 'dashboard' },
  steps_25: { icon: ListChecks, tone: 'from-blue-400 to-indigo-600', target: 'subtasks' },
  planner: { icon: CalendarCheck, tone: 'from-orange-300 to-orange-600', target: 'records' },
  focused: { icon: Clock, tone: 'from-fuchsia-400 to-purple-600', target: 'records' },
  semester_star: { icon: Crown, tone: 'from-yellow-300 to-amber-500', target: 'records' },
};

const TARGET_LABEL: Record<BadgeTarget, string> = {
  records: 'Go to All Records',
  subtasks: 'Go to Subtask Manager',
  dashboard: 'Go to Dashboard',
};

function progressText(a: Achievement): string {
  if (a.id === 'focused') {
    return `${Math.floor(a.current / 60)}h ${a.current % 60}m of 10h`;
  }
  return `${a.current} of ${a.target}`;
}

export function AchievementsView({
  settings,
  syllabus,
  dataVersion,
  onNavigate,
}: AchievementsViewProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const dateFormat = settings?.date_format ?? 'DD/MM/YYYY';

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.getTasks({ pageSize: 200, sort: 'manual' });
      setTasks(res.items);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Unable to load your badges.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, dataVersion]);

  const swayamStatus = syllabus?.parts.find((p) => p.part === 'Part C')?.course_status ?? null;
  const badges = useMemo(() => computeAchievements(tasks, swayamStatus), [tasks, swayamStatus]);
  const earnedCount = badges.filter((b) => b.earned).length;
  const next = nextAchievement(badges);

  if (loading) {
    return <p className="text-xs text-slate-500">Loading your badges…</p>;
  }

  const pct = calculateCompletionPercentage(earnedCount, badges.length);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100">Achievement Badges</h1>
        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
          Earn badges as you reach Semester III milestones, like finishing every record in a Part.
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

      <section
        aria-label="Badge summary"
        className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]"
      >
        <div className="p-5 rounded-lg bg-white dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800 flex items-center gap-4">
          <div className="w-14 h-14 shrink-0 rounded-full bg-gradient-to-br from-amber-300 to-amber-600 flex items-center justify-center shadow-md">
            <Award className="w-7 h-7 text-white" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0 space-y-1.5">
            <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
              {earnedCount} of {badges.length} badges earned
            </p>
            <div
              className="w-full h-2 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Badges earned"
            >
              <div className="h-full bg-amber-500 transition-all duration-200" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>

        <div className="p-5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex items-center gap-4">
          <Target className="w-6 h-6 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          {next ? (
            <div className="flex-1 min-w-0 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wide text-blue-700 dark:text-blue-300">
                  Next badge
                </p>
                <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                  {next.title} · {progressText(next)}
                </p>
                <p className="text-xs text-slate-600 dark:text-zinc-400">{next.hint}</p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate(BADGE_STYLE[next.id].target)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md whitespace-nowrap"
              >
                {TARGET_LABEL[BADGE_STYLE[next.id].target]}
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
              You have earned every badge. Congratulations!
            </p>
          )}
        </div>
      </section>

      <section aria-labelledby="badges-heading">
        <h2 id="badges-heading" className="sr-only">
          All badges
        </h2>
        <ul className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
          {badges.map((b) => {
            const style = BADGE_STYLE[b.id];
            const Icon = style.icon;
            const share = b.target > 0 ? Math.round((b.current / b.target) * 100) : 0;
            return (
              <li
                key={b.id}
                className={`p-4 rounded-lg border flex gap-4 ${
                  b.earned
                    ? 'bg-white dark:bg-zinc-900/90 border-amber-300 dark:border-amber-700/70 shadow-sm'
                    : 'bg-slate-50 dark:bg-zinc-900/50 border-slate-200 dark:border-zinc-800'
                }`}
              >
                <div
                  className={`relative w-14 h-14 shrink-0 rounded-full flex items-center justify-center ${
                    b.earned
                      ? `bg-gradient-to-br ${style.tone} shadow-md ring-4 ring-amber-100 dark:ring-amber-900/40`
                      : 'bg-slate-200 dark:bg-zinc-800'
                  }`}
                >
                  <Icon
                    className={`w-6 h-6 ${b.earned ? 'text-white' : 'text-slate-400 dark:text-zinc-500'}`}
                    aria-hidden="true"
                  />
                  {!b.earned && (
                    <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 flex items-center justify-center">
                      <Lock className="w-3 h-3 text-slate-500" aria-hidden="true" />
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3
                      className={`text-sm font-semibold ${
                        b.earned
                          ? 'text-slate-900 dark:text-zinc-100'
                          : 'text-slate-600 dark:text-zinc-400'
                      }`}
                    >
                      {b.title}
                    </h3>
                    <span
                      className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                        b.earned
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
                          : 'bg-slate-200 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}
                    >
                      {b.earned ? 'Earned' : 'Locked'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-zinc-400">
                    {b.earned ? b.description : b.hint}
                  </p>
                  {b.earned ? (
                    b.earned_at && (
                      <p className="text-[11px] text-amber-700 dark:text-amber-400">
                        Earned on {formatUtcTimestampLocal(b.earned_at, dateFormat).split(',')[0]}
                      </p>
                    )
                  ) : b.target === 0 ? (
                    <p className="text-[11px] text-slate-500">No records in this group right now.</p>
                  ) : (
                    <div className="space-y-1 pt-0.5">
                      <div
                        className="w-full h-1.5 bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden"
                        role="progressbar"
                        aria-valuenow={share}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${b.title} progress`}
                      >
                        <div className="h-full bg-blue-500" style={{ width: `${share}%` }} />
                      </div>
                      <p className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-zinc-400">
                        {progressText(b)}
                      </p>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="text-[11px] text-slate-500 dark:text-zinc-400">
        Badges update automatically from your records. If a record is moved back from Completed,
        its badge locks again until you finish it.
      </p>
    </div>
  );
}
