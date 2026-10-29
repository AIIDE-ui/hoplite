import React from 'react';
import {
  ArrowRight,
  ClipboardList,
  Compass,
  Download,
  FileText,
  GraduationCap,
  Lightbulb,
  ListChecks,
  Lock,
  RotateCcw,
  Search,
  StickyNote,
  Upload,
  User,
} from 'lucide-react';

type GuideTarget = 'dashboard' | 'records' | 'notes' | 'settings';

interface GettingStartedViewProps {
  onNavigate: (page: GuideTarget) => void;
}

const cardClass =
  'p-5 rounded-lg bg-white dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800';
const h2Class = 'flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-zinc-100';
const bodyClass = 'text-xs leading-relaxed text-slate-600 dark:text-zinc-400';
const linkButtonClass =
  'inline-flex items-center gap-1 text-xs font-medium text-blue-700 dark:text-blue-400 hover:underline';

const QUICK_STEPS: Array<{
  title: string;
  body: string;
  target: GuideTarget;
  action: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>;
}> = [
  {
    title: 'Fill in your profile',
    body: 'Add your name, roll number, college and pedagogy subject so your tracker is clearly yours.',
    target: 'settings',
    action: 'Open Settings',
    icon: User,
  },
  {
    title: 'See your Semester III records',
    body: 'All TNTEU records for Part A, Part B and Part C are already added for you. No setup needed.',
    target: 'records',
    action: 'Open All Records',
    icon: ClipboardList,
  },
  {
    title: 'Open a record and tick its checklist',
    body: 'Click any record title to open its details. Add the small steps you need, then tick them off as you finish.',
    target: 'records',
    action: 'Pick a record',
    icon: ListChecks,
  },
  {
    title: 'Write your first note',
    body: 'Save internship school details, guide teacher instructions or submission dates on the Notes page.',
    target: 'notes',
    action: 'Open Notes',
    icon: StickyNote,
  },
];

const SYLLABUS_PARTS = [
  {
    part: 'Part A',
    title: 'Teaching Competency and Practical Records',
    totals: '20 credits · 400 marks',
    detail:
      '16 practical records: Observation, Micro Teaching, Demonstration, Lesson Plan, Instructional Materials and Test and Measurement (Level I and Level II), plus Case Study, Psychology Practical, Environmental Education, and Student Portfolios and Reflective Journals.',
  },
  {
    part: 'Part B',
    title: 'EPC Records',
    totals: '4 credits · 80 marks',
    detail:
      'Reading and Reflecting on Texts, Drama and Art in Education, Critical Understanding of ICT, and Understanding the Self.',
  },
  {
    part: 'Part C',
    title: 'Online Course (SWAYAM)',
    totals: '1 credit · 20 marks',
    detail:
      'Set its course status (Not Started, In Progress or Completed) on the Dashboard. It is not a practical record, so it does not change your record completion percentage.',
  },
];

export function GettingStartedView({ onNavigate }: GettingStartedViewProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-zinc-100">
          <Compass className="w-5 h-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          Quick Start Guide
        </h1>
        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
          Everything you need to track your B.Ed. Semester III records, manage your work and take
          useful notes. It takes about five minutes to read.
        </p>
      </div>

      <section aria-labelledby="guide-steps" className={cardClass}>
        <h2 id="guide-steps" className={h2Class}>
          <GraduationCap className="w-4 h-4 text-slate-500" aria-hidden="true" />
          Start in 4 steps
        </h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2">
          {QUICK_STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <li
                key={step.title}
                className="flex gap-3 p-3 rounded-md border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/60"
              >
                <span
                  className="flex items-center justify-center w-7 h-7 shrink-0 rounded-full bg-blue-600 text-white text-xs font-bold"
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <div className="space-y-1.5 min-w-0">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-zinc-100">
                    <Icon className="w-3.5 h-3.5 shrink-0 text-slate-500" aria-hidden="true" />
                    {step.title}
                  </p>
                  <p className={bodyClass}>{step.body}</p>
                  <button
                    type="button"
                    onClick={() => onNavigate(step.target)}
                    className={linkButtonClass}
                  >
                    {step.action}
                    <ArrowRight className="w-3 h-3" aria-hidden="true" />
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="guide-syllabus" className={cardClass}>
        <h2 id="guide-syllabus" className={h2Class}>
          <ClipboardList className="w-4 h-4 text-slate-500" aria-hidden="true" />
          What the tracker includes
        </h2>
        <p className={`${bodyClass} mt-2`}>
          The tracker follows the TNTEU B.Ed. Semester III structure (CBCS 2021–2022 pattern).
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {SYLLABUS_PARTS.map((p) => (
            <div
              key={p.part}
              className="p-3 rounded-md border border-slate-200 dark:border-zinc-800 space-y-1"
            >
              <p className="text-xs font-semibold text-slate-900 dark:text-zinc-100">
                {p.part} — {p.title}
              </p>
              <p className="text-[11px] font-mono text-blue-700 dark:text-blue-400">{p.totals}</p>
              <p className={bodyClass}>{p.detail}</p>
            </div>
          ))}
        </div>
        <p className={`${bodyClass} mt-3`}>
          Teaching Competency is a practical demonstration before an invigilator, held later. It is
          not tracked as a record.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="guide-records" className={cardClass}>
          <h2 id="guide-records" className={h2Class}>
            <Search className="w-4 h-4 text-slate-500" aria-hidden="true" />
            Managing your records
          </h2>
          <ul className={`${bodyClass} mt-3 space-y-2 list-disc pl-4`}>
            <li>
              <strong className="text-slate-800 dark:text-zinc-200">Find a record:</strong> on All
              Records, search by title or notes, or filter by Part, status, priority or due date
              (Overdue, Due Today, Due Next 7 Days).
            </li>
            <li>
              <strong className="text-slate-800 dark:text-zinc-200">Update its status:</strong>{' '}
              press <em>Start</em> to move a record to In Progress, or <em>Resume</em> to reopen a
              completed one. You can also change the status inside the record.
            </li>
            <li>
              <strong className="text-slate-800 dark:text-zinc-200">Set due dates:</strong> give
              each record a due date so overdue work shows up on your Dashboard.
            </li>
            <li>
              <strong className="text-slate-800 dark:text-zinc-200">Update many at once:</strong>{' '}
              tick several records, choose a status and apply it to all of them together.
            </li>
            <li>
              <strong className="text-slate-800 dark:text-zinc-200">Arrange your list:</strong>{' '}
              sort by title, status, due date or recently updated. Choose <em>Manual Order</em> to
              move records up or down yourself. Switch between table and card view.
            </li>
          </ul>
        </section>

        <section aria-labelledby="guide-inside" className={cardClass}>
          <h2 id="guide-inside" className={h2Class}>
            <ListChecks className="w-4 h-4 text-slate-500" aria-hidden="true" />
            Inside a record
          </h2>
          <p className={`${bodyClass} mt-2`}>Click a record title to open its details panel.</p>
          <ul className={`${bodyClass} mt-2 space-y-2 list-disc pl-4`}>
            <li>
              <strong className="text-slate-800 dark:text-zinc-200">Details:</strong> change the
              status, priority, start date and due date, then press <em>Save Changes</em>.
            </li>
            <li>
              <strong className="text-slate-800 dark:text-zinc-200">Subtasks Checklist:</strong>{' '}
              break the record into small steps, such as “Write 5 lesson plans” or “Get guide
              teacher signature”. When every step is ticked, the app offers to mark the record
              Completed.
            </li>
            <li>
              <strong className="text-slate-800 dark:text-zinc-200">Record Notes:</strong> keep
              notes that belong only to this record.
            </li>
            <li>
              <strong className="text-slate-800 dark:text-zinc-200">Record History:</strong> see
              every change made to the record and when it happened.
            </li>
          </ul>
        </section>
      </div>

      <section aria-labelledby="guide-notes" className={cardClass}>
        <h2 id="guide-notes" className={h2Class}>
          <FileText className="w-4 h-4 text-slate-500" aria-hidden="true" />
          Taking notes effectively
        </h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-900 dark:text-zinc-100">
              Two kinds of notes
            </p>
            <ul className={`${bodyClass} space-y-2 list-disc pl-4`}>
              <li>
                <strong className="text-slate-800 dark:text-zinc-200">
                  General Semester Notes
                </strong>{' '}
                are for things that apply to the whole semester: internship school details,
                timetables and college announcements.
              </li>
              <li>
                <strong className="text-slate-800 dark:text-zinc-200">Record notes</strong> are
                linked to one record: what your guide teacher said, pages to redo, or topics to
                cover. They also appear inside that record.
              </li>
            </ul>
            <p className={bodyClass}>
              On the Notes page, use the filter to see all notes, only general notes, or the notes
              for one record, and search to find any word.
            </p>
          </div>
          <div className="p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-900 dark:text-amber-200">
              <Lightbulb className="w-3.5 h-3.5" aria-hidden="true" />
              Tips for useful notes
            </p>
            <ul className="text-xs leading-relaxed text-amber-900/90 dark:text-amber-100/90 space-y-1.5 list-disc pl-4">
              <li>Give every note a clear title, e.g., “Micro Teaching feedback — 12 Aug”.</li>
              <li>Write down instructions right after meeting your guide teacher.</li>
              <li>Link a note to its record so you find it when you open that record.</li>
              <li>Keep one general note for your internship school, class and timings.</li>
              <li>Note submission dates, then add them as due dates on the record.</li>
            </ul>
          </div>
        </div>
      </section>

      <section aria-labelledby="guide-safe" className={cardClass}>
        <h2 id="guide-safe" className={h2Class}>
          <Lock className="w-4 h-4 text-slate-500" aria-hidden="true" />
          Keep your work safe
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-zinc-100">
              <Download className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
              Export JSON
            </p>
            <p className={bodyClass}>
              Download a backup of all your records and notes. Do this every week.
            </p>
          </div>
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-zinc-100">
              <Upload className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
              Import JSON Backup
            </p>
            <p className={bodyClass}>Bring your work back from a backup file.</p>
          </div>
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-zinc-100">
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
              Restore original syllabus
            </p>
            <p className={bodyClass}>
              Brings back any missing or archived TNTEU records. Your edits, notes and checklists
              stay as they are.
            </p>
          </div>
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-zinc-100">
              <Lock className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
              Lock official totals
            </p>
            <p className={bodyClass}>Stops the official credits and marks from being changed by mistake.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('settings')}
          className={`${linkButtonClass} mt-4`}
        >
          All of these are in Settings
          <ArrowRight className="w-3 h-3" aria-hidden="true" />
        </button>
      </section>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60">
        <p className="text-xs text-blue-900 dark:text-blue-200">
          Ready? Your Dashboard shows your progress and what is due next.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('dashboard')}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md whitespace-nowrap"
        >
          Go to Dashboard
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
