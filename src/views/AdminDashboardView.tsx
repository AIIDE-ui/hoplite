import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Clock,
  KeyRound,
  Lock,
  LogOut,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import type {
  AdminAnalyticsResponse,
  AdminWorkspaceStat,
  AppSettings,
  AuthSessionResponse,
} from '../shared/constants.ts';
import { formatUtcTimestampLocal } from '../shared/stats.ts';
import { api, ApiClientError } from '../api/client.ts';

interface AdminDashboardViewProps {
  authSession: AuthSessionResponse | null;
  settings: AppSettings | null;
  onAuthChanged: () => Promise<void>;
}

export function AdminDashboardView({
  authSession,
  settings,
  onAuthChanged,
}: AdminDashboardViewProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [analytics, setAnalytics] = useState<AdminAnalyticsResponse | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [userActionNotice, setUserActionNotice] = useState<string | null>(null);

  // Admin credential update state
  const [showCredForm, setShowCredForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [credSaving, setCredSaving] = useState(false);
  const [credMsg, setCredMsg] = useState<string | null>(null);
  const [credError, setCredError] = useState<string | null>(null);

  // Edit Student User modal state
  const [editingUser, setEditingUser] = useState<AdminWorkspaceStat | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editRollNumber, setEditRollNumber] = useState('');
  const [editCollege, setEditCollege] = useState('');
  const [editNewPassword, setEditNewPassword] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete Student User modal state
  const [deletingUser, setDeletingUser] = useState<AdminWorkspaceStat | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const isAdminAuthenticated = Boolean(authSession?.admin_authenticated);
  const dateFormat = settings?.date_format ?? 'DD/MM/YYYY';
  const timeFormat = settings?.time_format ?? '12h';

  const fetchAnalytics = useCallback(async () => {
    if (!isAdminAuthenticated) return;
    setLoadingAnalytics(true);
    setAnalyticsError(null);
    try {
      const data = await api.getAdminAnalytics();
      setAnalytics(data);
    } catch (err) {
      setAnalyticsError(
        err instanceof ApiClientError ? err.message : 'Failed to load admin analytics.'
      );
    } finally {
      setLoadingAnalytics(false);
    }
  }, [isAdminAuthenticated]);

  useEffect(() => {
    if (isAdminAuthenticated) {
      fetchAnalytics();
    } else {
      setAnalytics(null);
    }
  }, [isAdminAuthenticated, fetchAnalytics]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);
    try {
      await api.loginAdmin({ username: username.trim(), password });
      setPassword('');
      await onAuthChanged();
    } catch (err) {
      setLoginError(
        err instanceof ApiClientError ? err.message : 'Invalid admin username or password.'
      );
    } finally {
      setLoginLoading(false);
    }
  };

  const handleAdminLogout = async () => {
    try {
      await api.logoutAdmin();
      setAnalytics(null);
      await onAuthChanged();
    } catch (err) {
      setAnalyticsError(
        err instanceof ApiClientError ? err.message : 'Failed to sign out of admin session.'
      );
    }
  };

  const handleUpdateCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setCredSaving(true);
    setCredMsg(null);
    setCredError(null);
    try {
      const res = await api.updateAdminCredentials({
        current_password: currentPassword,
        new_username: newUsername.trim() || undefined,
        new_password: newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setNewUsername(res.username);
      setCredMsg(`Admin credentials updated (@${res.username}).`);
      await onAuthChanged();
    } catch (err) {
      setCredError(
        err instanceof ApiClientError ? err.message : 'Failed to update admin credentials.'
      );
    } finally {
      setCredSaving(false);
    }
  };

  const openEditUserModal = (ws: AdminWorkspaceStat) => {
    setEditingUser(ws);
    setEditDisplayName(ws.label);
    setEditUsername(ws.username);
    setEditRollNumber(ws.roll_number === '—' ? '' : ws.roll_number);
    setEditCollege(ws.college === '—' ? '' : ws.college);
    setEditNewPassword('');
    setEditError(null);
  };

  const handleSaveUserEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditSaving(true);
    setEditError(null);
    setUserActionNotice(null);
    try {
      const payload: {
        username?: string;
        display_name?: string;
        roll_number?: string;
        college?: string;
        new_password?: string;
      } = {
        display_name: editDisplayName.trim(),
        username: editUsername.trim(),
        roll_number: editRollNumber.trim(),
        college: editCollege.trim(),
      };
      if (editNewPassword.trim().length > 0) {
        payload.new_password = editNewPassword;
      }
      const updated = await api.updateAdminUser(Number(editingUser.id), payload);
      setEditingUser(null);
      await fetchAnalytics();
      setUserActionNotice(`Updated student entry for ${updated.label} (@${updated.username}).`);
    } catch (err) {
      setEditError(
        err instanceof ApiClientError ? err.message : 'Failed to update student entry.'
      );
    } finally {
      setEditSaving(false);
    }
  };

  const handleConfirmDeleteUser = async () => {
    if (!deletingUser) return;
    setDeleteSubmitting(true);
    setDeleteError(null);
    setUserActionNotice(null);
    try {
      const res = await api.deleteAdminUser(Number(deletingUser.id));
      const deletedLabel = deletingUser.label;
      setDeletingUser(null);
      await fetchAnalytics();
      setUserActionNotice(`Deleted student entry ${deletedLabel} (@${res.username}).`);
    } catch (err) {
      setDeleteError(
        err instanceof ApiClientError ? err.message : 'Failed to delete student entry.'
      );
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // Never visible to student workspace accounts
  if (authSession?.user) {
    return null;
  }

  if (!isAdminAuthenticated) {
    return (
      <div className="max-w-md mx-auto py-12 px-4">
        <div className="p-6 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">
              <Lock className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-900 dark:text-zinc-100">
                Admin Analytics Login
              </h1>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Separate administrator authentication for server-wide SQLite analytics.
              </p>
            </div>
          </div>

          {loginError && (
            <div
              role="alert"
              className="p-3 rounded-md bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300"
            >
              {loginError}
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label
                htmlFor="admin-login-username"
                className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1"
              >
                Admin Username
              </label>
              <input
                id="admin-login-username"
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full px-3 py-2 text-xs rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 font-mono"
              />
            </div>

            <div>
              <label
                htmlFor="admin-login-password"
                className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1"
              >
                Admin Password
              </label>
              <input
                id="admin-login-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 text-xs rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100"
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-2 px-4 text-xs font-medium text-white dark:text-zinc-900 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 rounded-md transition-colors"
            >
              {loginLoading ? 'Signing in…' : 'Sign In to Admin Dashboard'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="p-4 sm:p-6 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" />
            <span className="font-mono">Admin Session · @{authSession?.admin_username || 'admin'}</span>
            <span aria-hidden="true">·</span>
            <span>Private Administrator View</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
            Admin Simple Analytics
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Live SQLite metrics aggregated across the primary database and isolated student workspaces.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={fetchAnalytics}
            disabled={loadingAnalytics}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-md"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingAnalytics ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowCredForm((prev) => !prev);
              setNewUsername(authSession?.admin_username || 'admin');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-md"
          >
            <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Credentials</span>
          </button>

          <button
            type="button"
            onClick={handleAdminLogout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 hover:bg-rose-100 rounded-md"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Sign Out Admin</span>
          </button>
        </div>
      </section>

      {/* Optional Credentials Update Panel */}
      {showCredForm && (
        <section className="p-4 sm:p-6 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                Update Admin Login & Password
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Stored hashed with scrypt in SQLite (<code className="font-mono">admin_credentials</code>).
              </p>
            </div>
          </div>

          {credError && (
            <div
              role="alert"
              className="p-3 rounded-md bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300"
            >
              {credError}
            </div>
          )}

          {credMsg && (
            <div
              role="status"
              className="p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300"
            >
              {credMsg}
            </div>
          )}

          <form onSubmit={handleUpdateCredentials} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <label
                htmlFor="admin-current-pass"
                className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1"
              >
                Current Password
              </label>
              <input
                id="admin-current-pass"
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
              />
            </div>

            <div>
              <label
                htmlFor="admin-new-user"
                className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1"
              >
                New Admin Username
              </label>
              <input
                id="admin-new-user"
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 font-mono"
              />
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <label
                  htmlFor="admin-new-pass"
                  className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1"
                >
                  New Password (min 4 chars)
                </label>
                <input
                  id="admin-new-pass"
                  type="password"
                  required
                  minLength={4}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                />
              </div>
              <button
                type="submit"
                disabled={credSaving}
                className="self-end px-3.5 py-1.5 text-xs font-medium text-white dark:text-zinc-900 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-md whitespace-nowrap"
              >
                {credSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </section>
      )}

      {analyticsError && (
        <div
          role="alert"
          className="p-3 rounded-md bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300"
        >
          {analyticsError}
        </div>
      )}

      {loadingAnalytics || !analytics ? (
        <div className="p-8 text-center text-xs text-slate-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-800">
          Loading SQLite analytics…
        </div>
      ) : (
        <>
          {/* KPI Summary Grid */}
          <section aria-label="Server-Wide Key Metrics" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-4 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
                <span>Workspaces</span>
                <Users className="w-3.5 h-3.5" aria-hidden="true" />
              </div>
              <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-zinc-100">
                {analytics.totals.total_workspaces}
              </div>
              <div className="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">
                {analytics.totals.registered_students} student accounts
              </div>
            </div>

            <div className="p-4 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
                <span>Total Records</span>
                <BarChart3 className="w-3.5 h-3.5" aria-hidden="true" />
              </div>
              <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-zinc-100">
                {analytics.totals.total_records}
              </div>
              <div className="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">
                Tracked in SQLite
              </div>
            </div>

            <div className="p-4 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
                <span>Completed</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" />
              </div>
              <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                {analytics.totals.completed_records}
              </div>
              <div className="mt-1 text-[11px] text-slate-500 dark:text-zinc-400 font-mono tabular-nums">
                {analytics.totals.completion_rate}% completion
              </div>
            </div>

            <div className="p-4 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
                <span>In Progress</span>
                <Activity className="w-3.5 h-3.5 text-blue-500" aria-hidden="true" />
              </div>
              <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400">
                {analytics.totals.in_progress_records}
              </div>
              <div className="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">
                Active records
              </div>
            </div>

            <div className="p-4 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
                <span>Pending</span>
                <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              </div>
              <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-700 dark:text-zinc-300">
                {analytics.totals.not_started_records}
              </div>
              <div className="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">
                Not Started
              </div>
            </div>

            <div className="p-4 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
                <span>Overdue</span>
                <Clock className="w-3.5 h-3.5 text-rose-500" aria-hidden="true" />
              </div>
              <div
                className={`mt-2 text-2xl font-bold font-mono tabular-nums ${
                  analytics.totals.overdue_records > 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-700 dark:text-zinc-300'
                }`}
              >
                {analytics.totals.overdue_records}
              </div>
              <div className="mt-1 text-[11px] text-slate-500 dark:text-zinc-400 font-mono tabular-nums">
                {analytics.totals.total_notes} total notes
              </div>
            </div>
          </section>

          {/* Overall Server Completion Bar */}
          <section className="p-4 sm:p-6 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-700 dark:text-zinc-300">
                Aggregate Completion Across All Workspaces
              </span>
              <span className="font-mono font-semibold text-slate-900 dark:text-zinc-100 tabular-nums">
                {analytics.totals.completed_records} /{' '}
                {analytics.totals.total_records} ({analytics.totals.completion_rate}
                %)
              </span>
            </div>
            <div className="w-full h-2 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-200"
                style={{ width: `${analytics.totals.completion_rate}%` }}
              />
            </div>
          </section>

          {/* Per-Workspace Breakdown */}
          <section className="rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                  Workspace Analytics Breakdown
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Progress summary and account management across each student SQLite database.
                </p>
              </div>
              <span className="text-xs font-mono text-slate-500 dark:text-zinc-400 tabular-nums">
                {analytics.workspaces.length}{' '}
                {analytics.workspaces.length === 1 ? 'workspace' : 'workspaces'}
              </span>
            </div>

            {userActionNotice && (
              <div
                role="status"
                className="mx-4 sm:mx-6 mt-4 p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between gap-2"
              >
                <span>{userActionNotice}</span>
                <button
                  type="button"
                  onClick={() => setUserActionNotice(null)}
                  aria-label="Dismiss notification"
                  className="text-emerald-700 dark:text-emerald-300 hover:opacity-80"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {analytics.workspaces.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 dark:text-zinc-400">
                No registered student workspaces yet.
              </div>
            ) : (
              <>
                {/* Mobile Stack Cards */}
                <div className="md:hidden divide-y divide-slate-100 dark:divide-zinc-800">
                  {analytics.workspaces.map((ws) => (
                    <div key={ws.id} className="p-4 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-zinc-100">
                            {ws.label}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 dark:text-zinc-400">
                            @{ws.username}
                            {ws.roll_number && ws.roll_number !== '—'
                              ? ` · Roll: ${ws.roll_number}`
                              : ''}
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 font-mono font-semibold text-slate-900 dark:text-zinc-100 tabular-nums">
                          {ws.completion_percentage}%
                        </span>
                      </div>

                      <div className="grid grid-cols-4 gap-2 pt-1 text-[11px] font-mono tabular-nums">
                        <div>
                          <span className="text-slate-500 dark:text-zinc-500 block">Done</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                            {ws.completed}/{ws.total_records}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-zinc-500 block">Active</span>
                          <span className="text-blue-600 dark:text-blue-400 font-semibold">
                            {ws.in_progress}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-zinc-500 block">Overdue</span>
                          <span
                            className={
                              ws.overdue > 0
                                ? 'text-rose-600 dark:text-rose-400 font-semibold'
                                : 'text-slate-700 dark:text-zinc-300'
                            }
                          >
                            {ws.overdue}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-zinc-500 block">SWAYAM</span>
                          <span className="text-slate-700 dark:text-zinc-300 truncate block">
                            {ws.part_c_status}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800/80">
                        <button
                          type="button"
                          onClick={() => openEditUserModal(ws)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-zinc-200 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded transition-colors"
                        >
                          <Pencil className="w-3 h-3" aria-hidden="true" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeletingUser(ws);
                            setDeleteError(null);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 hover:bg-rose-100 rounded transition-colors"
                        >
                          <Trash2 className="w-3 h-3" aria-hidden="true" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 bg-slate-50/50 dark:bg-zinc-950/40">
                        <th className="py-3 pl-6 pr-3 font-medium">Workspace</th>
                        <th className="py-3 px-3 font-medium">Account / Roll No.</th>
                        <th className="py-3 px-3 font-medium text-right">Completed</th>
                        <th className="py-3 px-3 font-medium text-right">In Progress</th>
                        <th className="py-3 px-3 font-medium text-right">Pending</th>
                        <th className="py-3 px-3 font-medium text-right">Overdue</th>
                        <th className="py-3 px-3 font-medium text-right">Notes</th>
                        <th className="py-3 px-3 font-medium">Part C (SWAYAM)</th>
                        <th className="py-3 px-3 font-medium text-right">Updated</th>
                        <th className="py-3 pl-3 pr-6 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                      {analytics.workspaces.map((ws) => (
                        <tr
                          key={ws.id}
                          className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors"
                        >
                          <td className="py-3 pl-6 pr-3 font-medium text-slate-900 dark:text-zinc-100">
                            {ws.label}
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-600 dark:text-zinc-400">
                            @{ws.username}
                            {ws.roll_number && ws.roll_number !== '—'
                              ? ` · ${ws.roll_number}`
                              : ''}
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold">
                            {ws.completed}/{ws.total_records} ({ws.completion_percentage}%)
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums text-blue-600 dark:text-blue-400">
                            {ws.in_progress}
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-zinc-400">
                            {ws.not_started}
                          </td>
                          <td
                            className={`py-3 px-3 text-right font-mono tabular-nums ${
                              ws.overdue > 0
                                ? 'text-rose-600 dark:text-rose-400 font-semibold'
                                : 'text-slate-500 dark:text-zinc-500'
                            }`}
                          >
                            {ws.overdue}
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-zinc-400">
                            {ws.notes_count}
                          </td>
                          <td className="py-3 px-3 text-slate-700 dark:text-zinc-300">
                            {ws.part_c_status}
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-500 dark:text-zinc-500 whitespace-nowrap">
                            {ws.last_updated_at
                              ? formatUtcTimestampLocal(ws.last_updated_at, dateFormat, timeFormat)
                              : '—'}
                          </td>
                          <td className="py-3 pl-3 pr-6 text-right whitespace-nowrap">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEditUserModal(ws)}
                                aria-label={`Edit user ${ws.username}`}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-zinc-200 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded transition-colors"
                              >
                                <Pencil className="w-3 h-3" aria-hidden="true" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setDeletingUser(ws);
                                  setDeleteError(null);
                                }}
                                aria-label={`Delete user ${ws.username}`}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 hover:bg-rose-100 rounded transition-colors"
                              >
                                <Trash2 className="w-3 h-3" aria-hidden="true" />
                                <span>Delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </>
      )}

      {/* Edit Student User Modal */}
      {editingUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[1px] p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !editSaving) setEditingUser(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-edit-user-title"
            className="w-full max-w-md rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-zinc-800">
              <div>
                <h3
                  id="admin-edit-user-title"
                  className="text-sm font-semibold text-slate-900 dark:text-zinc-100"
                >
                  Edit Student Entry
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
                  @{editingUser.username} · ID #{editingUser.id}
                </p>
              </div>
              <button
                type="button"
                disabled={editSaving}
                onClick={() => setEditingUser(null)}
                aria-label="Close edit student dialog"
                className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUserEdit} className="p-5 space-y-4">
              {editError && (
                <div
                  role="alert"
                  className="p-3 rounded-md bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300"
                >
                  {editError}
                </div>
              )}

              <div>
                <label
                  htmlFor="admin-edit-display-name"
                  className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1"
                >
                  Full Name <span className="text-rose-600">*</span>
                </label>
                <input
                  id="admin-edit-display-name"
                  type="text"
                  required
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="admin-edit-username"
                    className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1"
                  >
                    Username <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="admin-edit-username"
                    type="text"
                    required
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 font-mono"
                  />
                </div>

                <div>
                  <label
                    htmlFor="admin-edit-roll"
                    className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1"
                  >
                    Roll Number
                  </label>
                  <input
                    id="admin-edit-roll"
                    type="text"
                    value={editRollNumber}
                    onChange={(e) => setEditRollNumber(e.target.value)}
                    placeholder="Optional"
                    className="w-full px-3 py-2 text-xs rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 font-mono"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="admin-edit-college"
                  className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1"
                >
                  College
                </label>
                <input
                  id="admin-edit-college"
                  type="text"
                  value={editCollege}
                  onChange={(e) => setEditCollege(e.target.value)}
                  placeholder="Optional"
                  className="w-full px-3 py-2 text-xs rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label
                  htmlFor="admin-edit-password"
                  className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1"
                >
                  Reset Password (leave blank to keep current)
                </label>
                <input
                  id="admin-edit-password"
                  type="password"
                  minLength={6}
                  value={editNewPassword}
                  onChange={(e) => setEditNewPassword(e.target.value)}
                  placeholder="Minimum 6 characters if resetting"
                  className="w-full px-3 py-2 text-xs rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-zinc-800">
                <button
                  type="button"
                  disabled={editSaving}
                  onClick={() => setEditingUser(null)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="px-4 py-2 text-xs font-medium text-white dark:text-zinc-900 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 rounded-md"
                >
                  {editSaving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Student User Confirmation Modal */}
      {deletingUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[1px] p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deleteSubmitting) setDeletingUser(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-delete-user-title"
            className="w-full max-w-md rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-zinc-800">
              <h3
                id="admin-delete-user-title"
                className="text-sm font-semibold text-rose-600 dark:text-rose-400"
              >
                Delete Student Entry
              </h3>
              <button
                type="button"
                disabled={deleteSubmitting}
                onClick={() => setDeletingUser(null)}
                aria-label="Close delete confirmation dialog"
                className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {deleteError && (
                <div
                  role="alert"
                  className="p-3 rounded-md bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
                >
                  {deleteError}
                </div>
              )}

              <p className="text-slate-700 dark:text-zinc-300 leading-relaxed">
                Are you sure you want to permanently delete{' '}
                <strong className="font-semibold text-slate-900 dark:text-zinc-100">
                  {deletingUser.label}
                </strong>{' '}
                (<span className="font-mono">@{deletingUser.username}</span>)?
              </p>
              <p className="text-slate-500 dark:text-zinc-400">
                This removes their user account, active sessions, and isolated SQLite workspace
                database. This action cannot be undone.
              </p>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-zinc-800">
                <button
                  type="button"
                  disabled={deleteSubmitting}
                  onClick={() => setDeletingUser(null)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleteSubmitting}
                  onClick={handleConfirmDeleteUser}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-md"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{deleteSubmitting ? 'Deleting…' : 'Delete User Entry'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
