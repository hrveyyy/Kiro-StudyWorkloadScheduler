import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { runScheduler } from './scheduler.js';
import { getSeedTasks } from './seedData.js';
import {
  dbLoadTasks, dbAddTask, dbUpdateTask, dbCompleteTask, dbDeleteTask,
  dbLoadProfile, dbUpdateProfile,
  authGetSession, authOnChange, authSignOut,
} from './supabase.js';
import AuthPage from './AuthPage.jsx';
import TaskFormModal from './TaskForm.jsx';
import TaskTable from './TaskTable.jsx';
import DailySchedule from './DailySchedule.jsx';

export default function App() {
  // ── Auth / profile state ──────────────────────────────────────────────────
  const [session, setSession]           = useState(undefined); // undefined = checking
  const [profile, setProfile]           = useState(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // ── Task state ────────────────────────────────────────────────────────────
  const [tasks, setTasks]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const [dbError, setDbError]   = useState(null);

  // Daily cap — driven by profile.dailyHoursCap once loaded
  const [dailyHoursCap, setDailyHoursCap] = useState(3);
  const [capInput, setCapInput]           = useState('3');
  const capSaveTimer = useRef(null); // debounce DB writes

  const [highlightedTaskIds, setHighlightedTaskIds] = useState(new Set());
  const prevScheduleRef = useRef(null);

  // ── Modal state ───────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [editTask, setEditTask]   = useState(null);
  const [isSaving, setIsSaving]   = useState(false);

  // ── Bootstrap session ─────────────────────────────────────────────────────
  useEffect(() => {
    authGetSession().then((s) => setSession(s ?? null));
    const unsub = authOnChange((s) => setSession(s ?? null));
    return unsub;
  }, []);

  // ── Load profile + tasks whenever session changes ─────────────────────────
  useEffect(() => {
    if (session === undefined) return;
    if (!session) { setTasks([]); setProfile(null); return; }

    async function load() {
      setLoading(true);
      setDbError(null);
      try {
        // Load profile and tasks in parallel
        const [prof, data] = await Promise.all([dbLoadProfile(), dbLoadTasks()]);

        setProfile(prof);
        setDailyHoursCap(prof.dailyHoursCap);
        setCapInput(String(prof.dailyHoursCap));

        if (data.length === 0) {
          // First-time user — seed sample tasks
          const seeds = getSeedTasks().map((t) => ({
            ...t,
            id: `seed-${session.user.id.slice(0, 8)}-${t.id}`,
          }));
          const inserted = await Promise.all(
            seeds.map((t) => dbAddTask(t, session.user.id))
          );
          setTasks(inserted);
        } else {
          setTasks(data);
        }
      } catch (err) {
        console.error('Load failed:', err);
        setDbError(err.message ?? 'Could not load data.');
        setTasks(getSeedTasks());
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [session]);

  // ── Scheduler ─────────────────────────────────────────────────────────────
  const { scheduledTasks, dailySchedule } = useMemo(
    () => runScheduler(tasks, dailyHoursCap),
    [tasks, dailyHoursCap]
  );

  const taskMap = useMemo(
    () => Object.fromEntries(tasks.map((t) => [t.id, t])),
    [tasks]
  );

  // ── Highlight reshuffled entries ──────────────────────────────────────────
  useMemo(() => {
    const prev = prevScheduleRef.current;
    if (!prev) { prevScheduleRef.current = scheduledTasks; return; }
    const prevMap = Object.fromEntries(prev.map((st) => [st.taskId, st]));
    const changed = new Set();
    for (const st of scheduledTasks) {
      const p = prevMap[st.taskId];
      const prevStart = p?.allocations?.[0]?.dateStr ?? null;
      const currStart = st.allocations?.[0]?.dateStr ?? null;
      if (prevStart !== currStart) changed.add(st.taskId);
    }
    prevScheduleRef.current = scheduledTasks;
    if (changed.size > 0) {
      setHighlightedTaskIds(changed);
      setTimeout(() => setHighlightedTaskIds(new Set()), 1400);
    }
  }, [scheduledTasks]);

  // ── Modal helpers ─────────────────────────────────────────────────────────
  function openAddModal()      { setEditTask(null); setModalOpen(true); }
  function openEditModal(task) { setEditTask(task); setModalOpen(true); }
  function closeModal()        { if (!isSaving) { setModalOpen(false); setEditTask(null); } }

  // ── CRUD handlers ─────────────────────────────────────────────────────────
  const handleSave = useCallback(async (task) => {
    setIsSaving(true);
    try {
      if (editTask) {
        const updated = await dbUpdateTask(task, session.user.id);
        setTasks((prev) => prev.map((t) => t.id === updated.id ? updated : t));
      } else {
        const added = await dbAddTask(task, session.user.id);
        setTasks((prev) => [...prev, added]);
      }
      closeModal();
    } catch (err) {
      console.error('Save failed:', err);
      alert(`Failed to save task: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  }, [editTask, session]);

  const handleMarkComplete = useCallback(async (taskId) => {
    try {
      const updated = await dbCompleteTask(taskId);
      setTasks((prev) => prev.map((t) => t.id === updated.id ? updated : t));
    } catch (err) {
      alert(`Failed to update task: ${err.message}`);
    }
  }, []);

  const handleDelete = useCallback(async (taskId) => {
    try {
      await dbDeleteTask(taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (err) {
      alert(`Failed to delete task: ${err.message}`);
    }
  }, []);

  // ── Daily cap — update locally immediately, debounce DB write ─────────────
  const handleCapInput = useCallback((e) => {
    const raw = e.target.value;
    setCapInput(raw);
    const val = parseFloat(raw);
    if (isNaN(val) || val <= 0) return;

    setDailyHoursCap(val);

    // Debounce: save to profiles table 800ms after user stops typing
    clearTimeout(capSaveTimer.current);
    capSaveTimer.current = setTimeout(async () => {
      try {
        const updated = await dbUpdateProfile({ dailyHoursCap: val });
        setProfile(updated);
      } catch (err) {
        console.error('Failed to save daily cap:', err);
      }
    }, 800);
  }, []);

  // ── Sign out ──────────────────────────────────────────────────────────────
  const handleSignOut = useCallback(async () => {
    setUserMenuOpen(false);
    clearTimeout(capSaveTimer.current);
    try {
      await authSignOut();
    } catch (err) {
      console.warn('Sign-out error:', err);
    }
    // Force-clear session locally regardless of server response
    setSession(null);
    setProfile(null);
    setTasks([]);
  }, []);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalTasks      = tasks.length;
  const completedCount  = tasks.filter((t) => t.completed).length;
  const overloadedCount = scheduledTasks.filter((st) => st.isOverloaded).length;
  const blockedCount    = tasks.filter((t) => {
    if (t.completed || !t.dependsOn) return false;
    return taskMap[t.dependsOn] && !taskMap[t.dependsOn].completed;
  }).length;

  // ── Session loading ───────────────────────────────────────────────────────
  if (session === undefined) {
    return (
      <div className="loading-state" style={{ minHeight: '100vh' }}>
        <div className="spinner" />
        <p>Loading…</p>
      </div>
    );
  }

  // ── Auth gate ─────────────────────────────────────────────────────────────
  if (!session) {
    return <AuthPage onAuth={setSession} />;
  }

  // ── Resolved display info ─────────────────────────────────────────────────
  const displayName    = profile?.fullName || profile?.email || session.user?.email || 'User';
  const userInitial    = displayName[0].toUpperCase();
  const userEmail      = profile?.email || session.user?.email || '';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="app">

      {/* Backdrop rendered first so it's below the header in paint order */}
      {userMenuOpen && (
        <div className="user-menu-backdrop" onClick={() => setUserMenuOpen(false)} />
      )}

      {/* ── Header ── */}
      <header className="app-header">
        <div className="header-inner">
          <div className="header-title">
            <span className="header-icon">📚</span>
            <div>
              <h1>Study Workload Scheduler</h1>
              <p className="header-sub">Prioritize smarter, stress less</p>
            </div>
          </div>

          <div className="header-actions">
            <button className="btn btn-add-task" onClick={openAddModal} disabled={loading}>
              ➕ Add Task
            </button>

            {/* Daily cap — hidden on xs, shown sm+ via CSS */}
            <div className="cap-control">
              <label htmlFor="daily-cap">Daily Study Hours</label>
              <div className="cap-input-wrap">
                <input
                  id="daily-cap"
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={capInput}
                  onChange={handleCapInput}
                  className="cap-input"
                />
                <span className="cap-unit">hrs / day</span>
              </div>
            </div>

            {/* User menu */}
            <div className="user-menu-wrap">
              <button
                className="user-avatar-btn"
                onClick={() => setUserMenuOpen((o) => !o)}
                aria-label="User menu"
                aria-expanded={userMenuOpen}
              >
                <span className="user-avatar">{userInitial}</span>
              </button>

              {userMenuOpen && (
                <div
                  className="user-dropdown"
                  role="menu"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="user-dropdown-name">{displayName}</div>
                  <div className="user-dropdown-email">{userEmail}</div>
                  <hr className="user-dropdown-divider" />
                  <button
                    className="user-dropdown-item user-dropdown-signout"
                    role="menuitem"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleSignOut}
                  >
                    🚪 Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile-only cap row — visible only on xs where cap-control is hidden */}
        <div className="mobile-cap-row">
          <span className="mobile-cap-label">Daily Study Hours</span>
          <div className="mobile-cap-inner">
            <input
              type="number"
              min="0.5"
              step="0.5"
              value={capInput}
              onChange={handleCapInput}
              className="cap-input"
              aria-label="Daily hours cap"
            />
            <span className="cap-unit">hrs / day</span>
          </div>
        </div>

        {/* Stats bar */}
        <div className="stats-bar">
          <StatPill icon="📝" label="Total"      value={totalTasks} />
          <StatPill icon="✅" label="Done"       value={completedCount}  color="green" />
          <StatPill icon="🔒" label="Blocked"    value={blockedCount}    color={blockedCount > 0 ? 'amber' : undefined} />
          <StatPill icon="⚠️" label="Overloaded" value={overloadedCount} color={overloadedCount > 0 ? 'red' : undefined} />
        </div>
      </header>

      {/* ── Main ── */}
      <main className="app-main">
        {dbError && (
          <div className="db-error-banner" role="alert">
            <span>⚠️ Database error: {dbError} — showing local data only.</span>
            <button onClick={() => setDbError(null)}>✕</button>
          </div>
        )}

        {loading ? (
          <div className="loading-state">
            <div className="spinner" />
            <p>Loading your tasks…</p>
          </div>
        ) : (
          <>
            {overloadedCount > 0 && (
              <div className="overload-banner" role="alert">
                <span className="banner-icon">⚠️</span>
                <span>
                  <strong>{overloadedCount} task{overloadedCount > 1 ? 's are' : ' is'} overloaded</strong>
                  {' '}— not enough time before the deadline. Adjust deadlines, hours, or your daily cap.
                </span>
              </div>
            )}

            <div className="layout">
              <div className="col-left">
                <TaskTable
                  tasks={tasks}
                  scheduledTasks={scheduledTasks}
                  taskMap={taskMap}
                  onComplete={handleMarkComplete}
                  onEdit={openEditModal}
                  onDelete={handleDelete}
                />
              </div>
              <div className="col-right">
                <DailySchedule
                  dailySchedule={dailySchedule}
                  highlightedTaskIds={highlightedTaskIds}
                />
              </div>
            </div>
          </>
        )}
      </main>

      <footer className="app-footer">
        <p>Study Workload Scheduler · Powered by Supabase</p>
      </footer>

      <TaskFormModal
        isOpen={modalOpen}
        editTask={editTask}
        tasks={tasks}
        onSave={handleSave}
        onClose={closeModal}
        isSaving={isSaving}
      />

    </div>
  );
}

function StatPill({ icon, label, value, color }) {
  return (
    <div className={`stat-pill ${color ? `stat-${color}` : ''}`}>
      <span className="stat-icon">{icon}</span>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}
