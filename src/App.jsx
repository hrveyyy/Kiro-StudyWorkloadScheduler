import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { runScheduler } from './scheduler.js';
import { getSeedTasks } from './seedData.js';
import { dbLoadTasks, dbAddTask, dbUpdateTask, dbCompleteTask, dbDeleteTask } from './supabase.js';
import TaskFormModal from './TaskForm.jsx';
import TaskTable from './TaskTable.jsx';
import DailySchedule from './DailySchedule.jsx';

const DEFAULT_CAP = 3;

export default function App() {
  const [tasks, setTasks]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [dbError, setDbError]           = useState(null);
  const [dailyHoursCap, setDailyHoursCap] = useState(DEFAULT_CAP);
  const [capInput, setCapInput]         = useState(String(DEFAULT_CAP));
  const [highlightedTaskIds, setHighlightedTaskIds] = useState(new Set());
  const prevScheduleRef = useRef(null);

  // ── Modal state ───────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [editTask, setEditTask]   = useState(null);   // null = Add, Task = Edit
  const [isSaving, setIsSaving]   = useState(false);

  // ── Load tasks from Supabase on mount ────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const data = await dbLoadTasks();
        // If DB is empty, seed it with sample tasks
        if (data.length === 0) {
          const seeds = getSeedTasks();
          const inserted = await Promise.all(seeds.map(dbAddTask));
          setTasks(inserted);
        } else {
          setTasks(data);
        }
      } catch (err) {
        console.error('Failed to load tasks:', err);
        setDbError(err.message ?? 'Could not connect to database.');
        // Fall back to seed data in-memory so app still works
        setTasks(getSeedTasks());
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // ── Scheduler ─────────────────────────────────────────────────────────────
  const { scheduledTasks, dailySchedule } = useMemo(
    () => runScheduler(tasks, dailyHoursCap),
    [tasks, dailyHoursCap]
  );

  const taskMap = useMemo(
    () => Object.fromEntries(tasks.map((t) => [t.id, t])),
    [tasks]
  );

  // ── Highlight logic ───────────────────────────────────────────────────────
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
  function openAddModal() {
    setEditTask(null);
    setModalOpen(true);
  }

  function openEditModal(task) {
    setEditTask(task);
    setModalOpen(true);
  }

  function closeModal() {
    if (isSaving) return;
    setModalOpen(false);
    setEditTask(null);
  }

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSave = useCallback(async (task) => {
    setIsSaving(true);
    try {
      if (editTask) {
        // Edit mode
        const updated = await dbUpdateTask(task);
        setTasks((prev) => prev.map((t) => t.id === updated.id ? updated : t));
      } else {
        // Add mode
        const added = await dbAddTask(task);
        setTasks((prev) => [...prev, added]);
      }
      setModalOpen(false);
      setEditTask(null);
    } catch (err) {
      console.error('Save failed:', err);
      alert(`Failed to save task: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  }, [editTask]);

  const handleMarkComplete = useCallback(async (taskId) => {
    try {
      const updated = await dbCompleteTask(taskId);
      setTasks((prev) => prev.map((t) => t.id === updated.id ? updated : t));
    } catch (err) {
      console.error('Complete failed:', err);
      alert(`Failed to update task: ${err.message}`);
    }
  }, []);

  const handleDelete = useCallback(async (taskId) => {
    try {
      await dbDeleteTask(taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (err) {
      console.error('Delete failed:', err);
      alert(`Failed to delete task: ${err.message}`);
    }
  }, []);

  const handleCapInput = useCallback((e) => {
    const raw = e.target.value;
    setCapInput(raw);
    const val = parseFloat(raw);
    if (!isNaN(val) && val > 0) setDailyHoursCap(val);
  }, []);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalTasks      = tasks.length;
  const completedCount  = tasks.filter((t) => t.completed).length;
  const overloadedCount = scheduledTasks.filter((st) => st.isOverloaded).length;
  const blockedCount    = tasks.filter((t) => {
    if (t.completed || !t.dependsOn) return false;
    return taskMap[t.dependsOn] && !taskMap[t.dependsOn].completed;
  }).length;

  // ── Render ────────────────────────────────────────────────────────────────
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
            {/* Add Task button */}
            <button className="btn btn-add-task" onClick={openAddModal} disabled={loading}>
              ➕ Add Task
            </button>

            {/* Daily Cap */}
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
                  aria-label="Daily hours cap"
                />
                <span className="cap-unit">hrs / day</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="stats-bar">
          <StatPill icon="📝" label="Total"     value={totalTasks} />
          <StatPill icon="✅" label="Done"      value={completedCount}  color="green" />
          <StatPill icon="🔒" label="Blocked"   value={blockedCount}    color={blockedCount > 0 ? 'amber' : undefined} />
          <StatPill icon="⚠️" label="Overloaded" value={overloadedCount} color={overloadedCount > 0 ? 'red' : undefined} />
        </div>
      </header>

      <main className="app-main">
        {/* DB error banner */}
        {dbError && (
          <div className="db-error-banner" role="alert">
            <span>⚠️ Database error: {dbError} — showing local data only.</span>
            <button onClick={() => setDbError(null)}>✕</button>
          </div>
        )}

        {/* Loading state */}
        {loading ? (
          <div className="loading-state">
            <div className="spinner" />
            <p>Loading tasks from database…</p>
          </div>
        ) : (
          <>
            {/* Overload banner */}
            {overloadedCount > 0 && (
              <div className="overload-banner" role="alert">
                <span className="banner-icon">⚠️</span>
                <span>
                  <strong>{overloadedCount} task{overloadedCount > 1 ? 's are' : ' is'} overloaded</strong>
                  {' '}— not enough time before the deadline. Adjust deadlines, hours, or your daily cap.
                </span>
              </div>
            )}

            {/* Two-column layout */}
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

      {/* ── Modal ── */}
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
