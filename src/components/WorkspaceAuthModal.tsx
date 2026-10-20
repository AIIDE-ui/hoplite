import React, { useEffect, useState } from 'react';
import { Database, LogIn, LogOut, ShieldCheck, UserPlus, Users, X } from 'lucide-react';
import { APP_NAME, type AuthSessionResponse } from '../shared/constants.ts';
import { api, ApiClientError } from '../api/client.ts';
import { useFocusTrap } from '../hooks/useFocusTrap.ts';

interface WorkspaceAuthModalProps {
  open: boolean;
  session: AuthSessionResponse | null;
  onClose: () => void;
  onSessionChanged: () => Promise<void>;
  onOpenAdminDashboard?: () => void;
}

export function WorkspaceAuthModal({
  open,
  session,
  onClose,
  onSessionChanged,
  onOpenAdminDashboard,
}: WorkspaceAuthModalProps) {
  const modalRef = useFocusTrap<HTMLDivElement>(open);
  const [mode, setMode] = useState<'login' | 'register' | 'admin'>('login');

  // Login fields
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Admin Login fields
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  // Register fields
  const [regDisplayName, setRegDisplayName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regRollNumber, setRegRollNumber] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setError(null);
      setFieldErrors({});
      setLoginPassword('');
      setAdminPassword('');
      setRegPassword('');
      setMode('login');
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      await api.loginWorkspaceUser({
        username: loginUsername.trim(),
        password: loginPassword,
      });
      await onSessionChanged();
      onClose();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
        if (err.fields) setFieldErrors(err.fields);
      } else {
        setError('Unable to sign in. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      await api.loginAdmin({
        username: adminUsername.trim(),
        password: adminPassword,
      });
      await onSessionChanged();
      onClose();
      onOpenAdminDashboard?.();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Invalid admin credentials.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      await api.registerWorkspaceUser({
        username: regUsername.trim(),
        display_name: regDisplayName.trim(),
        roll_number: regRollNumber.trim(),
        password: regPassword,
      });
      await onSessionChanged();
      onClose();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
        if (err.fields) setFieldErrors(err.fields);
      } else {
        setError('Unable to create workspace. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogoutToDefault = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await api.logoutWorkspaceUser();
      await onSessionChanged();
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Unable to switch workspace.');
    } finally {
      setSubmitting(false);
    }
  };

  const currentUser = session?.user ?? null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-[1px] p-0 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-modal-title"
        className="w-full max-w-lg max-h-[92dvh] sm:max-h-[90vh] flex flex-col rounded-t-xl sm:rounded-lg bg-white dark:bg-zinc-900 border-t sm:border border-slate-200 dark:border-zinc-800 shadow-xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <Users className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" aria-hidden="true" />
            <div>
              <h2
                id="workspace-modal-title"
                className="text-sm sm:text-base font-semibold text-slate-900 dark:text-zinc-100 leading-tight"
              >
                {APP_NAME}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                B.Ed. Sem III · TNTEU — Switch Student Workspace
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close workspace dialog"
            className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
          {/* Current Workspace Status */}
          <div className="p-3.5 rounded-md bg-slate-50 dark:bg-zinc-950/60 border border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-zinc-100">
                <Database className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>
                  {currentUser
                    ? `${currentUser.display_name} (@${currentUser.username})`
                    : 'Default Local Workspace'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
                {currentUser
                  ? `Isolated SQLite DB: data/users/${currentUser.db_filename}`
                  : 'Primary SQLite DB: data/bed-tracker.sqlite'}
              </p>
            </div>

            {currentUser && (
              <button
                type="button"
                disabled={submitting}
                onClick={handleLogoutToDefault}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-md whitespace-nowrap self-start sm:self-auto"
              >
                <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Switch to Default</span>
              </button>
            )}
          </div>

          <p className="text-xs text-slate-600 dark:text-zinc-400">
            Each student gets their own isolated SQLite database pre-seeded with all 20 TNTEU B.Ed.
            Semester III practical records. All accounts and data remain strictly private.
          </p>

          {/* Mode Tabs — Admin Login tab is hidden whenever a student account is signed in */}
          <div
            className={`grid ${
              currentUser ? 'grid-cols-2' : 'grid-cols-3'
            } gap-1.5 p-1 bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-md`}
          >
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
                setFieldErrors({});
              }}
              className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded transition-colors ${
                mode === 'login'
                  ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Student Sign In</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
                setFieldErrors({});
              }}
              className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded transition-colors ${
                mode === 'register'
                  ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>New Student</span>
            </button>
            {!currentUser && (
              <button
                type="button"
                onClick={() => {
                  setMode('admin');
                  setError(null);
                  setFieldErrors({});
                }}
                className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded transition-colors ${
                  mode === 'admin'
                    ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Admin Login</span>
              </button>
            )}
          </div>

          {error && (
            <div
              role="alert"
              className="p-3 rounded-md bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300"
            >
              {error}
            </div>
          )}

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label
                  htmlFor="ws-login-username"
                  className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1"
                >
                  Username <span className="text-rose-600">*</span>
                </label>
                <input
                  id="ws-login-username"
                  type="text"
                  required
                  autoComplete="username"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="e.g., karthik"
                  className="w-full px-3 py-2 text-xs rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label
                  htmlFor="ws-login-password"
                  className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1"
                >
                  Password <span className="text-rose-600">*</span>
                </label>
                <input
                  id="ws-login-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter your workspace password"
                  className="w-full px-3 py-2 text-xs rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-md whitespace-nowrap"
                >
                  <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{submitting ? 'Signing in…' : 'Open My Tracker'}</span>
                </button>
              </div>
            </form>
          ) : mode === 'admin' && !currentUser ? (
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label
                  htmlFor="ws-admin-username"
                  className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1"
                >
                  Admin Username <span className="text-rose-600">*</span>
                </label>
                <input
                  id="ws-admin-username"
                  type="text"
                  required
                  autoComplete="username"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full px-3 py-2 text-xs rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 font-mono"
                />
              </div>

              <div>
                <label
                  htmlFor="ws-admin-password"
                  className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1"
                >
                  Admin Password <span className="text-rose-600">*</span>
                </label>
                <input
                  id="ws-admin-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter administrator password"
                  className="w-full px-3 py-2 text-xs rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-zinc-950 bg-zinc-100 hover:bg-white disabled:opacity-50 rounded-md whitespace-nowrap"
                >
                  <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{submitting ? 'Signing in…' : 'Open Admin Analytics'}</span>
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="ws-reg-name"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Student Full Name <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="ws-reg-name"
                    type="text"
                    required
                    value={regDisplayName}
                    onChange={(e) => setRegDisplayName(e.target.value)}
                    placeholder="e.g., Priya Raman"
                    className="w-full px-3 py-2 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                  {fieldErrors.display_name && (
                    <p className="mt-1 text-[11px] text-rose-600">{fieldErrors.display_name}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="ws-reg-username"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Username <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="ws-reg-username"
                    type="text"
                    required
                    autoComplete="username"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="e.g., priya_bed"
                    className="w-full px-3 py-2 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono"
                  />
                  {fieldErrors.username && (
                    <p className="mt-1 text-[11px] text-rose-600">{fieldErrors.username}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="ws-reg-roll"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Roll / Register Number (optional)
                  </label>
                  <input
                    id="ws-reg-roll"
                    type="text"
                    value={regRollNumber}
                    onChange={(e) => setRegRollNumber(e.target.value)}
                    placeholder="Optional roll number"
                    className="w-full px-3 py-2 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>

                <div>
                  <label
                    htmlFor="ws-reg-password"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Password (min 6 chars) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="ws-reg-password"
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full px-3 py-2 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                  {fieldErrors.password && (
                    <p className="mt-1 text-[11px] text-rose-600">{fieldErrors.password}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-md whitespace-nowrap"
                >
                  <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{submitting ? 'Creating DB…' : 'Create Isolated Workspace'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
