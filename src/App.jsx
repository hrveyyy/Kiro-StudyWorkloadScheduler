import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { runScheduler } from './scheduler.js';
import { getSeedTasks } from './seedData.js';
import {
  dbLoadTasks, dbAddTask, dbUpdateTask, dbCompleteTask, dbDeleteTask,
  authGetSession, authOnChange, authSignOut,
} from './supabase.js';
import AuthPage from './AuthPage.jsx';
import TaskFormModal from './TaskForm.jsx';
import TaskTable from './TaskTable.jsx';
import DailySchedule from './DailySchedule.jsx';

const DEFAULT_CAP = 3;

export default function App() {
  // ── Auth state ────────────────────────────────────────────────────────────
  const [session, setSession]         = useState(undefined); // undefined = still checking
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // ── Task state ────────────────────────────────────────────────────────────
  const [tasks, setTasks]             = useState([]);
  const [loading, setLoading]         = useState(false);
  const [dbError, setDbError]         = useState(null);
  const [dailyHoursCap, setDailyHoursCap] = useState(DEFAULT_CAP);
  const [capInput, setCapInput]       = useState(String(DEFAULT_CAP));
  const [highlightedTaskIds, setHighlightedTaskIds] = useState(new Set());
  const prevScheduleRef = useRef(null);

  // ── Modal state ───────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen]     = useState(false);
  const [editTask, setEditTask]       = useState(null);
  const [isSaving, setIsSaving]       = useState(false);

  // ── Bootstrap: check existing session on mount ───────────────────────────
  useEffect(() => {
    authGetSession().then((s) => setSession(s ?? null));

    // Subscribe to auth changes (login / logout / token refresh)
    const unsub = authOnChange((s) => setSession(s ?? null));
    return unsub;
  }, []);

  // ── Load tasks whenever session changes ───────────────────────────────────
  useEffect(() => {
    if (!session) {
      setTasks([]);
      return;
    }

    async function load() {
      setLoading(true);
      setDbError(null);
      try {
        const data = await dbLoadTasks();
        if (data.length === 0) {
          // Seed for first-time users
          const seeds = getSeedTasks().map((t) => ({ ...t, id: `seed-${session.user.id.slice(0,8)}-${t.id}` }));
          const inserted = await Promise.all(seeds.map((t) => dbAddTask(t, session.user.id)));
          setTasks(inserted);
        } else {
          setTasks(data);
        }
      } catch (err) {
        console.error('Load tasks failed:', err);
        setDbError(err.message ?? 'Could not load tasks.');
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
  function openAddModal()  { setEditTask(null); setModalOpen(true); }
  function openEditModal(task) { setEditTask(task); setModalOpen(true); }
  function closeModal()    { if (!isSaving) { setModalOpen(false); setEditTask(null); } }

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

  const handleCapInput = useCallback((e) => {
    const raw = e.target.value;
    setCapInput(raw);
    const val = parseFloat(raw);
    if (!isNaN(val) && val > 0) setDailyHoursCap(val);
  }, []);

  const handleSignOut = useCallback(async () => {
    setUserMenuOpen(false);
    await authSignOut();
    // authOnChange listener will set session to null
  }, []);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalTasks      = tasks.length;
  const completedCount  = tasks.filter((t) => t.completed).length;
  const overloadedCount = scheduledTasks.filter((st) => st.isOverloaded).length;
  const blockedCount    = tasks.filter((t) => {
    if (t.completed || !t.dependsOn) return false;
    return taskMap[t.dependsOn] && !taskMap[t.dependsOn].completed;
  }).length;

  // ── Auth loading (session check in progress) ──────────────────────────────
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

  // ── Main app ──────────────────────────────────────────────────────────────
  const userEmail = session.user?.email ?? 'User';
  const userInitial = userEmail[0].toUpperCase();

  return (
    <div className="app">
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
                <div className="user-dropdown" role="menu">
                  <div className="user-dropdown-email">{userEmail}</div>
                  <hr className="user-dropdown-divider" />
                  <button
                    className="user-dropdown-item user-dropdown-signout"
                    role="menuitem"
                    onClick={handleSignOut}
                  >
                    🚪 Sign Out
                  </button>
                </div>
              )}
            </div>
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

      {/* Close user menu on outside click */}
      {userMenuOpen && (
        <div className="user-menu-backdrop" onClick={() => setUserMenuOpen(false)} />
      )}
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
