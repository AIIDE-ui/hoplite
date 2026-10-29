import React, { useCallback, useEffect, useState } from 'react';
import {
  BookOpen,
  ClipboardList,
  Compass,
  FileText,
  LayoutDashboard,
  Menu,
  Moon,
  Settings,
  ShieldCheck,
  Sun,
  User,
  Users,
  X,
} from 'lucide-react';
import {
  APP_NAME,
  type AppSettings,
  type AuthSessionResponse,
  type Category,
  type DashboardSummary,
  type StudentProfile,
  type SyllabusOverviewResponse,
  type TaskActivity,
} from './shared/constants.ts';
import { api } from './api/client.ts';
import { DashboardView } from './views/DashboardView.tsx';
import { RecordsView } from './views/RecordsView.tsx';
import { NotesView } from './views/NotesView.tsx';
import { SettingsView } from './views/SettingsView.tsx';
import { AdminDashboardView } from './views/AdminDashboardView.tsx';
import { GettingStartedView } from './views/GettingStartedView.tsx';
import { TaskDetailDrawer } from './components/TaskDetailDrawer.tsx';
import { RestoreSyllabusModal } from './components/RestoreSyllabusModal.tsx';
import { WorkspaceAuthModal } from './components/WorkspaceAuthModal.tsx';

type NavPage = 'dashboard' | 'records' | 'notes' | 'settings' | 'admin' | 'guide';

function parsePathToPage(pathname: string): NavPage {
  const clean = pathname.replace(/\/+$/, '').toLowerCase();
  if (clean === '/records') return 'records';
  if (clean === '/notes') return 'notes';
  if (clean === '/settings') return 'settings';
  if (clean === '/admin') return 'admin';
  if (clean === '/getting-started') return 'guide';
  return 'dashboard';
}

function pageToPath(page: NavPage): string {
  if (page === 'dashboard') return '/';
  if (page === 'guide') return '/getting-started';
  return `/${page}`;
}

export function App() {
  const [activePage, setActivePage] = useState<NavPage>(() =>
    parsePathToPage(window.location.pathname)
  );
  const [urlParams, setUrlParams] = useState<URLSearchParams>(
    () => new URLSearchParams(window.location.search)
  );
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Server state
  const [authSession, setAuthSession] = useState<AuthSessionResponse | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [syllabus, setSyllabus] = useState<SyllabusOverviewResponse | null>(null);
  const [activity, setActivity] = useState<TaskActivity[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [dataVersion, setDataVersion] = useState(0);

  // Modals & Drawers
  const [detailTaskId, setDetailTaskId] = useState<number | null>(null);
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);

  useEffect(() => {
    document.title = APP_NAME;
  }, []);

  const applyThemeToDom = useCallback((theme: 'light' | 'dark') => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const refreshCoreData = useCallback(async () => {
    const [sessionRes, profRes, setRes, catRes, sumRes, actRes] = await Promise.all([
      api.getAuthSession(),
      api.getProfile(),
      api.getSettings(),
      api.getCategories(),
      api.getDashboardSummary(),
      api.getRecentActivity(20),
    ]);
    setAuthSession(sessionRes);
    setProfile(profRes);
    setSettings(setRes);
    setCategories(catRes);
    setSummary(sumRes);
    setSyllabus(sumRes.syllabus);
    setActivity(actRes);
    setDataVersion((v) => v + 1);
    applyThemeToDom(setRes.theme);
  }, [applyThemeToDom]);

  useEffect(() => {
    refreshCoreData().finally(() => {
      setLoadingInitial(false);
    });
  }, [refreshCoreData]);

  useEffect(() => {
    const handlePopState = () => {
      setActivePage(parsePathToPage(window.location.pathname));
      setUrlParams(new URLSearchParams(window.location.search));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = useCallback(
    (page: NavPage, queryOverrides?: Record<string, string | undefined>) => {
      const sp = new URLSearchParams();
      if (queryOverrides) {
        for (const [k, v] of Object.entries(queryOverrides)) {
          if (v !== undefined && v !== '') {
            sp.set(k, v);
          }
        }
      }
      const nextPath = pageToPath(page);
      const nextUrl = sp.toString() ? `${nextPath}?${sp.toString()}` : nextPath;
      window.history.pushState({}, '', nextUrl);
      setActivePage(page);
      setUrlParams(sp);
      setMobileSidebarOpen(false);
    },
    []
  );

  // Ensure Admin Dashboard is never visible when a student workspace account is logged in
  useEffect(() => {
    if (authSession?.user && activePage === 'admin') {
      navigateTo('dashboard');
    }
  }, [authSession?.user, activePage, navigateTo]);

  const updateUrlParams = useCallback((updates: Record<string, string | undefined>) => {
    setUrlParams((prev) => {
      const next = new URLSearchParams(prev.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === undefined || v === '') {
          next.delete(k);
        } else {
          next.set(k, v);
        }
      }
      const nextUrl = next.toString()
        ? `${window.location.pathname}?${next.toString()}`
        : window.location.pathname;
      window.history.replaceState({}, '', nextUrl);
      return next;
    });
  }, []);

  const handleToggleTheme = async () => {
    const currentTheme = settings?.theme ?? 'dark';
    const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
    const updated = await api.updateSettings({ theme: nextTheme });
    setSettings(updated);
    applyThemeToDom(updated.theme);
  };

  const currentCatParam = urlParams.get('category') || 'all';
  const isStudentAccountLoggedIn = Boolean(authSession?.user);
  const isAdminSessionActive = Boolean(authSession?.admin_authenticated && !authSession?.user);

  return (
    <div className="min-h-dvh flex bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100">
      {/* Mobile Sidebar Backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[1px] lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        aria-label="Primary Sidebar Navigation"
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-white dark:bg-zinc-900 border-r border-slate-200 dark:border-zinc-800 flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-14 sm:h-16 px-4 sm:px-5 flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 shrink-0">
          <button
            type="button"
            onClick={() => navigateTo('dashboard')}
            className="text-left focus-visible:outline-2 focus-visible:outline-blue-600 rounded"
          >
            <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-zinc-100 block whitespace-nowrap">
              {APP_NAME}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-zinc-400 block">
              TNTEU · B.Ed. Semester III
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="Close navigation menu"
            className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200 lg:hidden rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-3.5 space-y-6 overflow-y-auto" aria-label="Main Navigation">
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => navigateTo('dashboard')}
              aria-current={activePage === 'dashboard' ? 'page' : undefined}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                activePage === 'dashboard'
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400'
                  : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Dashboard</span>
            </button>

            <button
              type="button"
              onClick={() => navigateTo('records')}
              aria-current={
                activePage === 'records' && currentCatParam === 'all' ? 'page' : undefined
              }
              className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                activePage === 'records' && currentCatParam === 'all'
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400'
                  : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <ClipboardList className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>All Records</span>
              </span>
              {summary && (
                <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-zinc-400">
                  {summary.total}
                </span>
              )}
            </button>

            {/* Syllabus Presets inside Sidebar */}
            <div className="pl-3 space-y-1 pt-1 border-l border-slate-200 dark:border-zinc-800 ml-4">
              <button
                type="button"
                onClick={() => navigateTo('records', { category: 'part_a' })}
                className={`w-full text-left px-2.5 py-1.5 text-xs rounded-md transition-colors whitespace-nowrap ${
                  activePage === 'records' && currentCatParam === 'part_a'
                    ? 'bg-slate-100 dark:bg-zinc-800 font-semibold text-slate-900 dark:text-zinc-100'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                }`}
              >
                Part A
              </button>

              <button
                type="button"
                onClick={() => navigateTo('records', { category: 'part_b' })}
                className={`w-full text-left px-2.5 py-1.5 text-xs rounded-md transition-colors whitespace-nowrap ${
                  activePage === 'records' && currentCatParam === 'part_b'
                    ? 'bg-slate-100 dark:bg-zinc-800 font-semibold text-slate-900 dark:text-zinc-100'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                }`}
              >
                Part B
              </button>

              <button
                type="button"
                onClick={() => navigateTo('records', { category: 'part_c' })}
                className={`w-full text-left px-2.5 py-1.5 text-xs rounded-md transition-colors whitespace-nowrap ${
                  activePage === 'records' && currentCatParam === 'part_c'
                    ? 'bg-slate-100 dark:bg-zinc-800 font-semibold text-slate-900 dark:text-zinc-100'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                }`}
              >
                Part C — Online Course (SWAYAM)
              </button>
            </div>

            <button
              type="button"
              onClick={() => navigateTo('notes')}
              aria-current={activePage === 'notes' ? 'page' : undefined}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                activePage === 'notes'
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400'
                  : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
              }`}
            >
              <FileText className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Notes</span>
            </button>

            <button
              type="button"
              onClick={() => navigateTo('settings')}
              aria-current={activePage === 'settings' ? 'page' : undefined}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                activePage === 'settings'
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400'
                  : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
              }`}
            >
              <Settings className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Settings</span>
            </button>

            <button
              type="button"
              onClick={() => navigateTo('guide')}
              aria-current={activePage === 'guide' ? 'page' : undefined}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                activePage === 'guide'
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400'
                  : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
              }`}
            >
              <Compass className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Quick Start Guide</span>
            </button>

            {/* Admin Dashboard link — only visible when admin session is active AND no student account is logged in */}
            {isAdminSessionActive && (
              <button
                type="button"
                onClick={() => navigateTo('admin')}
                aria-current={activePage === 'admin' ? 'page' : undefined}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                  activePage === 'admin'
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400'
                    : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
                }`}
              >
                <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Admin Analytics</span>
              </button>
            )}
          </div>
        </nav>

        {/* Sidebar Footer Summary */}
        <div className="p-4 border-t border-slate-200 dark:border-zinc-800 text-xs text-slate-500 dark:text-zinc-400 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-zinc-300">
              <BookOpen className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>{profile?.syllabus_pattern || 'CBCS 2021–2022'}</span>
            </div>
            {/* Separate Admin Login entry point — completely hidden when any student account is logged in */}
            {!isStudentAccountLoggedIn && (
              <button
                type="button"
                onClick={() => navigateTo('admin')}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 bg-slate-100 dark:bg-zinc-800/80 rounded transition-colors"
              >
                <ShieldCheck className="w-3 h-3" aria-hidden="true" />
                <span>Admin</span>
              </button>
            )}
          </div>
          <p className="text-[11px] truncate font-mono">
            {authSession?.user
              ? `SQLite: @${authSession.user.username}`
              : 'Local SQLite storage · Default'}
          </p>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-14 sm:h-16 px-3 sm:px-6 bg-white/95 dark:bg-zinc-900/95 backdrop-blur border-b border-slate-200 dark:border-zinc-800 grid grid-cols-3 items-center gap-2 sm:gap-4 shrink-0 sticky top-0 z-30">
          {/* Left: Mobile Sidebar Toggle */}
          <div className="flex items-center justify-start min-w-0">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open navigation menu"
              className="p-1.5 sm:p-2 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-md lg:hidden shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>

          {/* Center Top: Switch Student Button Link (opens popup) */}
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={() => setWorkspaceModalOpen(true)}
              aria-label="Switch or create student workspace"
              className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 text-xs font-medium text-slate-700 dark:text-zinc-200 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700 rounded-md whitespace-nowrap transition-colors cursor-pointer"
            >
              <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" aria-hidden="true" />
              <span>
                {authSession?.user
                  ? `Switch Student (@${authSession.user.username})`
                  : 'Switch Student'}
              </span>
            </button>
          </div>

          {/* Right: Profile & Theme Toggle */}
          <div className="flex items-center justify-end gap-1.5 sm:gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => navigateTo('settings')}
              aria-label="Student profile settings"
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-md whitespace-nowrap"
            >
              <User className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden md:inline">
                {profile?.name?.trim() ? profile.name : 'Profile'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleToggleTheme}
              aria-label={`Switch to ${settings?.theme === 'dark' ? 'light' : 'dark'} theme`}
              className="p-1.5 sm:p-2 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-md"
            >
              {settings?.theme === 'dark' ? (
                <Sun className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Moon className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-3 sm:p-6 lg:p-8 pb-20 lg:pb-8 max-w-7xl w-full mx-auto">
          {activePage === 'dashboard' && (
            <DashboardView
              profile={profile}
              settings={settings}
              summary={summary}
              activity={activity}
              loading={loadingInitial}
              onNavigateRecords={(filters) => navigateTo('records', filters)}
              onOpenTaskDetail={(id) => setDetailTaskId(id)}
              onRefresh={refreshCoreData}
            />
          )}

          {activePage === 'records' && (
            <RecordsView
              categories={categories}
              settings={settings}
              syllabus={syllabus}
              urlParams={urlParams}
              dataVersion={dataVersion}
              onUpdateUrlParams={updateUrlParams}
              onOpenTaskDetail={(id) => setDetailTaskId(id)}
              onDataChanged={refreshCoreData}
            />
          )}

          {activePage === 'notes' && (
            <NotesView
              settings={settings}
              dataVersion={dataVersion}
              onOpenTaskDetail={(id) => setDetailTaskId(id)}
            />
          )}

          {activePage === 'settings' && (
            <SettingsView
              authSession={authSession}
              profile={profile}
              settings={settings}
              categories={categories}
              syllabus={syllabus}
              onOpenWorkspaceModal={() => setWorkspaceModalOpen(true)}
              onOpenRestoreSyllabus={() => setRestoreModalOpen(true)}
              onDataChanged={refreshCoreData}
            />
          )}

          {activePage === 'admin' && !isStudentAccountLoggedIn && (
            <AdminDashboardView
              authSession={authSession}
              settings={settings}
              onAuthChanged={refreshCoreData}
            />
          )}

          {activePage === 'guide' && <GettingStartedView onNavigate={(page) => navigateTo(page)} />}
        </main>

        {/* Mobile Bottom Navigation Bar */}
        <nav
          aria-label="Mobile Bottom Navigation"
          className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-zinc-900/95 backdrop-blur border-t border-slate-200 dark:border-zinc-800 grid grid-cols-4 h-14 px-1"
        >
          <button
            type="button"
            onClick={() => navigateTo('dashboard')}
            aria-current={activePage === 'dashboard' ? 'page' : undefined}
            className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
              activePage === 'dashboard'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-slate-500 dark:text-zinc-400'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" aria-hidden="true" />
            <span>Dashboard</span>
          </button>

          <button
            type="button"
            onClick={() => navigateTo('records')}
            aria-current={activePage === 'records' ? 'page' : undefined}
            className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
              activePage === 'records'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-slate-500 dark:text-zinc-400'
            }`}
          >
            <ClipboardList className="w-4 h-4" aria-hidden="true" />
            <span>Records</span>
          </button>

          <button
            type="button"
            onClick={() => navigateTo('notes')}
            aria-current={activePage === 'notes' ? 'page' : undefined}
            className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
              activePage === 'notes'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-slate-500 dark:text-zinc-400'
            }`}
          >
            <FileText className="w-4 h-4" aria-hidden="true" />
            <span>Notes</span>
          </button>

          <button
            type="button"
            onClick={() => navigateTo('settings')}
            aria-current={activePage === 'settings' ? 'page' : undefined}
            className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
              activePage === 'settings'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-slate-500 dark:text-zinc-400'
            }`}
          >
            <Settings className="w-4 h-4" aria-hidden="true" />
            <span>Settings</span>
          </button>
        </nav>
      </div>

      {/* Task Detail Drawer */}
      <TaskDetailDrawer
        taskId={detailTaskId}
        categories={categories}
        settings={settings}
        onClose={() => setDetailTaskId(null)}
        onUpdated={refreshCoreData}
      />

      {/* Restore Original Syllabus Modal */}
      <RestoreSyllabusModal
        open={restoreModalOpen}
        onClose={() => setRestoreModalOpen(false)}
        onRestored={refreshCoreData}
      />

      {/* Multi-User / Friend Workspace Switcher Modal */}
      <WorkspaceAuthModal
        open={workspaceModalOpen}
        session={authSession}
        onClose={() => setWorkspaceModalOpen(false)}
        onSessionChanged={async () => {
          setDetailTaskId(null);
          await refreshCoreData();
        }}
        onOpenAdminDashboard={() => navigateTo('admin')}
      />
    </div>
  );
}
