import React, { useEffect, useState } from 'react';
import {
  Database,
  Download,
  Lock,
  RotateCcw,
  Save,
  Unlock,
  Upload,
  Users,
} from 'lucide-react';
import {
  DATE_FORMATS,
  LOCAL_USE_NOTICE,
  THEME_MODES,
  TIME_FORMATS,
  WEEK_STARTS,
  type AppSettings,
  type AuthSessionResponse,
  type Category,
  type DateFormat,
  type StudentProfile,
  type SyllabusOverviewResponse,
  type ThemeMode,
  type TimeFormat,
  type WeekStart,
} from '../shared/constants.ts';
import { formatUtcTimestampLocal } from '../shared/stats.ts';
import { api, ApiClientError } from '../api/client.ts';

interface SettingsViewProps {
  authSession: AuthSessionResponse | null;
  profile: StudentProfile | null;
  settings: AppSettings | null;
  categories: Category[];
  syllabus: SyllabusOverviewResponse | null;
  onOpenWorkspaceModal: () => void;
  onOpenRestoreSyllabus: () => void;
  onDataChanged: () => Promise<void>;
}

export function SettingsView({
  authSession,
  profile,
  settings,
  categories,
  syllabus,
  onOpenWorkspaceModal,
  onOpenRestoreSyllabus,
  onDataChanged,
}: SettingsViewProps) {
  // Profile state
  const [name, setName] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [university, setUniversity] = useState('TNTEU');
  const [programme, setProgramme] = useState('B.Ed.');
  const [semester, setSemester] = useState('3');
  const [syllabusPattern, setSyllabusPattern] = useState('CBCS 2021–2022');
  const [academicYear, setAcademicYear] = useState('2025–2027');
  const [college, setCollege] = useState('');
  const [teachingSubject, setTeachingSubject] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSavedMsg, setProfileSavedMsg] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Preferences state
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [weekStart, setWeekStart] = useState<WeekStart>('Mon');
  const [dateFormat, setDateFormat] = useState<DateFormat>('DD/MM/YYYY');
  const [timeFormat, setTimeFormat] = useState<TimeFormat>('12h');
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSavedMsg, setSettingsSavedMsg] = useState<string | null>(null);

  // Category edits state
  const [catEdits, setCatEdits] = useState<
    Record<number, { name: string; description: string; note: string }>
  >({});
  const [catError, setCatError] = useState<string | null>(null);
  const [catSuccess, setCatSuccess] = useState<string | null>(null);

  // Official totals editing state
  const [unlockOfficialDialog, setUnlockOfficialDialog] = useState(false);
  const [officialUnlocked, setOfficialUnlocked] = useState(false);
  const [officialEdits, setOfficialEdits] = useState<
    Record<string, { credits: string; marks: string; note: string }>
  >({});
  const [officialMessage, setOfficialMessage] = useState<string | null>(null);
  const [officialError, setOfficialError] = useState<string | null>(null);

  // Backup Import state
  const [pendingBackupJson, setPendingBackupJson] = useState<Record<string, unknown> | null>(null);
  const [pendingBackupFileName, setPendingBackupFileName] = useState<string>('');
  const [importingBackup, setImportingBackup] = useState(false);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setRollNumber(profile.roll_number);
      setUniversity(profile.university);
      setProgramme(profile.programme);
      setSemester(String(profile.semester));
      setSyllabusPattern(profile.syllabus_pattern);
      setAcademicYear(profile.academic_year);
      setCollege(profile.college);
      setTeachingSubject(profile.teaching_subject);
    }
  }, [profile]);

  useEffect(() => {
    if (settings) {
      setTheme(settings.theme);
      setWeekStart(settings.week_start);
      setDateFormat(settings.date_format);
      setTimeFormat(settings.time_format);
    }
  }, [settings]);

  useEffect(() => {
    const map: Record<number, { name: string; description: string; note: string }> = {};
    for (const c of categories) {
      map[c.id] = {
        name: c.name,
        description: c.description,
        note: c.note ?? '',
      };
    }
    setCatEdits(map);
  }, [categories]);

  useEffect(() => {
    if (syllabus) {
      const map: Record<string, { credits: string; marks: string; note: string }> = {};
      for (const p of syllabus.parts) {
        map[p.part] = {
          credits: String(p.official_credits),
          marks: String(p.official_marks),
          note: p.note,
        };
      }
      setOfficialEdits(map);
    }
  }, [syllabus]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileSavedMsg(null);
    setProfileError(null);
    try {
      await api.updateProfile({
        name,
        roll_number: rollNumber,
        university,
        programme,
        semester: Number(semester) || 3,
        syllabus_pattern: syllabusPattern,
        academic_year: academicYear,
        college,
        teaching_subject: teachingSubject,
      });
      await onDataChanged();
      setProfileSavedMsg('Profile saved.');
    } catch (err) {
      setProfileError(err instanceof ApiClientError ? err.message : 'Failed to save profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSaving(true);
    setSettingsSavedMsg(null);
    try {
      await api.updateSettings({
        theme,
        week_start: weekStart,
        date_format: dateFormat,
        time_format: timeFormat,
      });
      await onDataChanged();
      setSettingsSavedMsg('Preferences saved.');
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleSaveCategory = async (catId: number) => {
    const edit = catEdits[catId];
    if (!edit) return;
    setCatError(null);
    setCatSuccess(null);
    try {
      await api.updateCategory(catId, {
        name: edit.name,
        description: edit.description,
        note: edit.note,
      });
      await onDataChanged();
      setCatSuccess('Syllabus category updated.');
    } catch (err) {
      setCatError(err instanceof ApiClientError ? err.message : 'Failed to update category.');
    }
  };

  const handleSaveOfficialPart = async (part: string) => {
    const edit = officialEdits[part];
    if (!edit) return;
    setOfficialError(null);
    setOfficialMessage(null);
    try {
      await api.updateSyllabusPart(part, {
        official_credits: Number(edit.credits),
        official_marks: Number(edit.marks),
        note: edit.note,
        confirm: true,
      });
      await onDataChanged();
      setOfficialMessage(`Updated official totals for ${part}.`);
    } catch (err) {
      setOfficialError(
        err instanceof ApiClientError ? err.message : 'Failed to update official totals.'
      );
    }
  };

  const handleExportJson = async () => {
    const backup = await api.getBackupJson();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `semester3-bed-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleSelectBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setBackupError(null);
    setBackupMsg(null);
    if (!file) {
      setPendingBackupJson(null);
      setPendingBackupFileName('');
      return;
    }
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Record<string, unknown>;
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.tasks)) {
        setBackupError('Selected file is not a valid Semester 3 backup JSON (missing tasks array).');
        setPendingBackupJson(null);
        return;
      }
      setPendingBackupFileName(file.name);
      setPendingBackupJson(parsed);
    } catch {
      setBackupError('Could not parse JSON file. Please select a valid exported backup file.');
      setPendingBackupJson(null);
    }
  };

  const handleConfirmImportBackup = async () => {
    if (!pendingBackupJson) return;
    setImportingBackup(true);
    setBackupError(null);
    setBackupMsg(null);
    try {
      const result = await api.importBackupJson(pendingBackupJson);
      setPendingBackupJson(null);
      setPendingBackupFileName('');
      await onDataChanged();
      setBackupMsg(
        `Backup imported into SQLite (${result.imported_tasks} records, ${result.imported_subtasks} subtasks, ${result.imported_notes} notes).`
      );
    } catch (err) {
      setBackupError(err instanceof ApiClientError ? err.message : 'Failed to import backup JSON.');
    } finally {
      setImportingBackup(false);
    }
  };

  const officialCategories = categories.filter(
    (c) => c.seed_key === 'part_a' || c.seed_key === 'part_b' || c.seed_key === 'part_c'
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100">Settings</h1>
        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
          Manage your B.Ed. student profile, separate student SQLite workspaces, display
          preferences, syllabus categories, official totals, and local SQLite backups.
        </p>
      </div>

      {/* 0. Multi-Student Workspaces (Separate SQLite Trackers) */}
      <section className="p-6 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100">
                Student & Friend Workspaces (Isolated SQLite Databases)
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Each student account provisions a dedicated SQLite database file under{' '}
              <code className="font-mono">data/users/</code> with all 20 TNTEU B.Ed. Semester III
              records so you and your friends can track progress independently.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenWorkspaceModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white dark:text-zinc-900 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-md whitespace-nowrap self-start sm:self-auto"
          >
            <Users className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Switch / Create Student Workspace</span>
          </button>
        </div>

        <div className="p-3.5 rounded-md bg-slate-50 dark:bg-zinc-950/60 border border-slate-200 dark:border-zinc-800 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <span className="text-slate-500 dark:text-zinc-500 block">Active Workspace</span>
            <span className="font-semibold text-slate-900 dark:text-zinc-100">
              {authSession?.user
                ? `${authSession.user.display_name} (@${authSession.user.username})`
                : 'Default Local Workspace (Single-User)'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 dark:text-zinc-500 block">Workspace Privacy</span>
            <span className="font-mono text-slate-900 dark:text-zinc-100">
              Private &amp; isolated SQLite data
            </span>
          </div>
        </div>
      </section>

      {/* 1. Student Profile Form */}
      <section className="p-6 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100">
            Student Profile
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Persisted in SQLite (<code className="font-mono">student_profile</code>). Name and roll
            number are optional.
          </p>
        </div>

        {profileError && (
          <div
            role="alert"
            className="p-3 rounded-md bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300"
          >
            {profileError}
          </div>
        )}
        {profileSavedMsg && (
          <div
            role="status"
            className="p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300"
          >
            {profileSavedMsg}
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="profile-name"
                className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1"
              >
                Student Name
              </label>
              <input
                id="profile-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                className="w-full px-3 py-2 text-xs rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
              />
            </div>

            <div>
              <label
                htmlFor="profile-roll"
                className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1"
              >
                Roll / Register Number
              </label>
              <input
                id="profile-roll"
                type="text"
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                placeholder="Optional roll number"
                className="w-full px-3 py-2 text-xs rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 font-mono"
              />
            </div>

            <div>
              <label
                htmlFor="profile-university"
                className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1"
              >
                University
              </label>
              <input
                id="profile-university"
                type="text"
                value={university}
                onChange={(e) => setUniversity(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
              />
            </div>

            <div>
              <label
                htmlFor="profile-programme"
                className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1"
              >
                Programme
              </label>
              <input
                id="profile-programme"
                type="text"
                value={programme}
                onChange={(e) => setProgramme(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
              />
            </div>

            <div>
              <label
                htmlFor="profile-semester"
                className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1"
              >
                Semester
              </label>
              <input
                id="profile-semester"
                type="number"
                min="1"
                max="8"
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 tabular-nums"
              />
            </div>

            <div>
              <label
                htmlFor="profile-pattern"
                className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1"
              >
                Syllabus Pattern
              </label>
              <input
                id="profile-pattern"
                type="text"
                value={syllabusPattern}
                onChange={(e) => setSyllabusPattern(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
              />
            </div>

            <div>
              <label
                htmlFor="profile-year"
                className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1"
              >
                Academic Year
              </label>
              <input
                id="profile-year"
                type="text"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                placeholder="e.g., 2025–2027"
                className="w-full px-3 py-2 text-xs rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
              />
            </div>

            <div>
              <label
                htmlFor="profile-college"
                className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1"
              >
                College (optional)
              </label>
              <input
                id="profile-college"
                type="text"
                value={college}
                onChange={(e) => setCollege(e.target.value)}
                placeholder="College of Education name"
                className="w-full px-3 py-2 text-xs rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
              />
            </div>

            <div>
              <label
                htmlFor="profile-subject"
                className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1"
              >
                Pedagogy / Teaching Subject (optional)
              </label>
              <input
                id="profile-subject"
                type="text"
                value={teachingSubject}
                onChange={(e) => setTeachingSubject(e.target.value)}
                placeholder="e.g., Mathematics, English, Physical Science"
                className="w-full px-3 py-2 text-xs rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={profileSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white dark:text-zinc-900 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 rounded-md whitespace-nowrap"
            >
              <Save className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{profileSaving ? 'Saving…' : 'Save Profile'}</span>
            </button>
          </div>
        </form>
      </section>

      {/* 2. Display & Formatting Preferences */}
      <section className="p-6 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100">
            Display & Formatting Preferences
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Stored in <code className="font-mono">app_settings</code> on the server.
          </p>
        </div>

        {settingsSavedMsg && (
          <div
            role="status"
            className="p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300"
          >
            {settingsSavedMsg}
          </div>
        )}

        <form onSubmit={handleSavePreferences} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label
                htmlFor="pref-theme"
                className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1"
              >
                Theme
              </label>
              <select
                id="pref-theme"
                value={theme}
                onChange={(e) => setTheme(e.target.value as ThemeMode)}
                className="w-full px-3 py-2 text-xs rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
              >
                {THEME_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m === 'dark' ? 'Dark (Minimalist Default)' : 'Light'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="pref-week-start"
                className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1"
              >
                Week Starts On
              </label>
              <select
                id="pref-week-start"
                value={weekStart}
                onChange={(e) => setWeekStart(e.target.value as WeekStart)}
                className="w-full px-3 py-2 text-xs rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
              >
                {WEEK_STARTS.map((w) => (
                  <option key={w} value={w}>
                    {w === 'Mon' ? 'Monday' : 'Sunday'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="pref-date-format"
                className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1"
              >
                Date Format
              </label>
              <select
                id="pref-date-format"
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value as DateFormat)}
                className="w-full px-3 py-2 text-xs rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 font-mono"
              >
                {DATE_FORMATS.map((df) => (
                  <option key={df} value={df}>
                    {df}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="pref-time-format"
                className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1"
              >
                Time Format
              </label>
              <select
                id="pref-time-format"
                value={timeFormat}
                onChange={(e) => setTimeFormat(e.target.value as TimeFormat)}
                className="w-full px-3 py-2 text-xs rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
              >
                {TIME_FORMATS.map((tf) => (
                  <option key={tf} value={tf}>
                    {tf === '12h' ? '12-hour (AM/PM)' : '24-hour'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={settingsSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white dark:text-zinc-900 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 rounded-md whitespace-nowrap"
            >
              <Save className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{settingsSaving ? 'Saving…' : 'Save Preferences'}</span>
            </button>
          </div>
        </form>
      </section>

      {/* 3. Official Syllabus Parts Management */}
      <section className="p-6 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100">
            Official Syllabus Parts & Descriptions
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Edit descriptions and notes for the official syllabus components (Part A, Part B, Part C).
          </p>
        </div>

        {catError && (
          <div
            role="alert"
            className="p-3 rounded-md bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300"
          >
            {catError}
          </div>
        )}
        {catSuccess && (
          <div
            role="status"
            className="p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300"
          >
            {catSuccess}
          </div>
        )}

        <div className="space-y-4">
          {officialCategories.map((cat) => {
            const edit = catEdits[cat.id] || {
              name: cat.name,
              description: cat.description,
              note: cat.note,
            };
            return (
              <div
                key={cat.id}
                className="p-4 rounded-md border border-slate-200 dark:border-zinc-800 space-y-3"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor={`cat-name-${cat.id}`}
                      className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1"
                    >
                      Part Name
                    </label>
                    <input
                      id={`cat-name-${cat.id}`}
                      type="text"
                      value={edit.name}
                      onChange={(e) =>
                        setCatEdits((prev) => ({
                          ...prev,
                          [cat.id]: { ...edit, name: e.target.value },
                        }))
                      }
                      className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`cat-desc-${cat.id}`}
                      className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1"
                    >
                      Description
                    </label>
                    <input
                      id={`cat-desc-${cat.id}`}
                      type="text"
                      value={edit.description}
                      onChange={(e) =>
                        setCatEdits((prev) => ({
                          ...prev,
                          [cat.id]: { ...edit, description: e.target.value },
                        }))
                      }
                      className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor={`cat-note-${cat.id}`}
                    className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1"
                  >
                    Note
                  </label>
                  <input
                    id={`cat-note-${cat.id}`}
                    type="text"
                    value={edit.note}
                    onChange={(e) =>
                      setCatEdits((prev) => ({
                        ...prev,
                        [cat.id]: { ...edit, note: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-slate-500 dark:text-zinc-500 font-mono">
                    Official ({cat.seed_key}) · {cat.task_count ?? 0} active records
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSaveCategory(cat.id)}
                    className="px-3 py-1 text-xs font-medium text-white dark:text-zinc-900 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded whitespace-nowrap"
                  >
                    Save Part
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. Official Syllabus Totals */}
      <section className="p-6 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Official Syllabus Totals
            </h2>
            <p className="text-xs text-slate-500">
              Read-only by default so task edits never alter official university credit/mark
              allocations.
            </p>
          </div>

          {!officialUnlocked ? (
            <button
              type="button"
              onClick={() => setUnlockOfficialDialog(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-md whitespace-nowrap self-start sm:self-auto"
            >
              <Lock className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Edit official totals</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setOfficialUnlocked(false)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 rounded-md whitespace-nowrap self-start sm:self-auto"
            >
              <Unlock className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Lock official totals</span>
            </button>
          )}
        </div>

        {unlockOfficialDialog && !officialUnlocked && (
          <div
            role="alertdialog"
            aria-labelledby="unlock-official-heading"
            className="p-4 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 space-y-2 text-xs"
          >
            <p
              id="unlock-official-heading"
              className="font-semibold text-amber-900 dark:text-amber-200"
            >
              Confirm editing official TNTEU syllabus totals?
            </p>
            <p className="text-amber-800 dark:text-amber-300">
              Official totals default to Part A (20 credits / 400 marks), Part B (4 credits / 80
              marks), and Part C (1 credit / 20 marks). Only unlock if your syllabus regulation
              specifies different official totals.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setOfficialUnlocked(true);
                  setUnlockOfficialDialog(false);
                }}
                className="px-3 py-1.5 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 rounded"
              >
                Confirm Unlock
              </button>
              <button
                type="button"
                onClick={() => setUnlockOfficialDialog(false)}
                className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {officialError && (
          <div
            role="alert"
            className="p-3 rounded-md bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300"
          >
            {officialError}
          </div>
        )}
        {officialMessage && (
          <div
            role="status"
            className="p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300"
          >
            {officialMessage}
          </div>
        )}

        {syllabus && (
          <div className="space-y-3">
            {syllabus.parts.map((part) => {
              const edit = officialEdits[part.part] || {
                credits: String(part.official_credits),
                marks: String(part.official_marks),
                note: part.note,
              };
              return (
                <div
                  key={part.part}
                  className="p-4 rounded-md border border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
                >
                  <div className="md:col-span-4">
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 block">
                      {part.part}
                    </span>
                    <span className="text-xs text-slate-500">{part.title}</span>
                  </div>
                  <div className="md:col-span-2">
                    <label
                      htmlFor={`official-credits-${part.part}`}
                      className="block text-xs text-slate-600 dark:text-slate-400 mb-1"
                    >
                      Official Credits
                    </label>
                    <input
                      id={`official-credits-${part.part}`}
                      type="number"
                      step="0.5"
                      min="0"
                      disabled={!officialUnlocked}
                      value={edit.credits}
                      onChange={(e) =>
                        setOfficialEdits((prev) => ({
                          ...prev,
                          [part.part]: { ...edit, credits: e.target.value },
                        }))
                      }
                      className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 disabled:bg-slate-100 dark:disabled:bg-slate-800/60 font-mono tabular-nums"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label
                      htmlFor={`official-marks-${part.part}`}
                      className="block text-xs text-slate-600 dark:text-slate-400 mb-1"
                    >
                      Official Marks
                    </label>
                    <input
                      id={`official-marks-${part.part}`}
                      type="number"
                      step="1"
                      min="0"
                      disabled={!officialUnlocked}
                      value={edit.marks}
                      onChange={(e) =>
                        setOfficialEdits((prev) => ({
                          ...prev,
                          [part.part]: { ...edit, marks: e.target.value },
                        }))
                      }
                      className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 disabled:bg-slate-100 dark:disabled:bg-slate-800/60 font-mono tabular-nums"
                    />
                  </div>
                  <div className="md:col-span-4 flex justify-end">
                    {officialUnlocked && (
                      <button
                        type="button"
                        onClick={() => handleSaveOfficialPart(part.part)}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded whitespace-nowrap"
                      >
                        Save {part.part} Totals
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 5. Database Info, Export JSON, Restore Syllabus & Local-Use Notice */}
      <section className="p-6 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-slate-500" aria-hidden="true" />
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Data, Backup & SQLite Storage
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-md bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-xs">
          <div>
            <span className="text-slate-500 block">SQLite Database File Path</span>
            <code className="font-mono text-slate-900 dark:text-slate-100 break-all">
              {settings?.db_path || 'data/bed-tracker.sqlite'}
            </code>
          </div>
          <div>
            <span className="text-slate-500 block">Database Initialized At</span>
            <span className="font-mono text-slate-900 dark:text-slate-100 tabular-nums">
              {settings?.db_created_at
                ? formatUtcTimestampLocal(
                    settings.db_created_at,
                    settings.date_format,
                    settings.time_format
                  )
                : '—'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md whitespace-nowrap"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            <span>Export JSON</span>
          </button>

          <label className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md whitespace-nowrap cursor-pointer">
            <Upload className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            <span>Import JSON Backup</span>
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleSelectBackupFile}
              className="sr-only"
            />
          </label>

          <button
            type="button"
            onClick={onOpenRestoreSyllabus}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md whitespace-nowrap"
          >
            <RotateCcw className="w-4 h-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            <span>Restore original syllabus</span>
          </button>
        </div>

        {backupError && (
          <div
            role="alert"
            className="p-3 rounded-md bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300"
          >
            {backupError}
          </div>
        )}

        {backupMsg && (
          <div
            role="status"
            className="p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300"
          >
            {backupMsg}
          </div>
        )}

        {pendingBackupJson && (
          <div
            role="alertdialog"
            aria-labelledby="confirm-backup-import-title"
            className="p-4 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 space-y-2 text-xs"
          >
            <p
              id="confirm-backup-import-title"
              className="font-semibold text-amber-900 dark:text-amber-200"
            >
              Restore SQLite workspace from &ldquo;{pendingBackupFileName}&rdquo;?
            </p>
            <p className="text-amber-800 dark:text-amber-300">
              Importing this snapshot will replace the current workspace&apos;s records, subtasks,
              notes, and focus sessions with the{' '}
              <strong>
                {Array.isArray(pendingBackupJson.tasks) ? pendingBackupJson.tasks.length : 0}
              </strong>{' '}
              record(s) in the backup file.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                disabled={importingBackup}
                onClick={handleConfirmImportBackup}
                className="px-3.5 py-1.5 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded"
              >
                {importingBackup ? 'Importing…' : 'Confirm Import'}
              </button>
              <button
                type="button"
                disabled={importingBackup}
                onClick={() => {
                  setPendingBackupJson(null);
                  setPendingBackupFileName('');
                }}
                className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
          <strong>Local-Use Notice:</strong> {LOCAL_USE_NOTICE}
        </div>
      </section>
    </div>
  );
}
