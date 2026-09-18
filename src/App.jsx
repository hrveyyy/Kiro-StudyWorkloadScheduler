import { useState, useMemo, useRef, useCallback } from 'react';
import { runScheduler } from './scheduler.js';
import { getSeedTasks } from './seedData.js';
import TaskForm from './TaskForm.jsx';
import TaskTable from './TaskTable.jsx';
import DailySchedule from './DailySchedule.jsx';

const SEED_TASKS = getSeedTasks();
const DEFAULT_CAP = 3;

export default function App() {
  const [tasks, setTasks] = useState(SEED_TASKS);
  const [dailyHoursCap, setDailyHoursCap] = useState(DEFAULT_CAP);
  const [capInput, setCapInput] = useState(String(DEFAULT_CAP));
  const [highlightedTaskIds, setHighlightedTaskIds] = useState(new Set());
  const prevScheduleRef = useRef(null); // previous scheduledTasks for diff

  // ── Run the scheduler whenever tasks or cap changes ──────────────────────
  const { scheduledTasks, dailySchedule } = useMemo(
    () => runScheduler(tasks, dailyHoursCap),
    [tasks, dailyHoursCap]
  );

  // Build task map for quick lookup
  const taskMap = useMemo(
    () => Object.fromEntries(tasks.map((t) => [t.id, t])),
    [tasks]
  );

  // ── Highlight logic: detect tasks whose startDate changed ────────────────
  useMemo(() => {
    const prev = prevScheduleRef.current;
    if (!prev) {
      prevScheduleRef.current = scheduledTasks;
      return;
    }

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
      // Clear highlight after animation duration
      setTimeout(() => setHighlightedTaskIds(new Set()), 1400);
    }
  }, [scheduledTasks]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleAddTask = useCallback((task) => {
    setTasks((prev) => [...prev, task]);
  }, []);

  const handleMarkComplete = useCallback((taskId) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, completed: true } : t))
    );
  }, []);

  const handleCapInput = useCallback((e) => {
    const raw = e.target.value;
    setCapInput(raw);
    const val = parseFloat(raw);
    if (!isNaN(val) && val > 0) {
      setDailyHoursCap(val);
    }
  }, []);

  // Stats
  const totalTasks = tasks.length;
  const completedCount = tasks.filter((t) => t.completed).length;
  const overloadedCount = scheduledTasks.filter((st) => st.isOverloaded).length;
  const blockedCount = tasks.filter((t) => {
    if (t.completed || !t.dependsOn) return false;
    const dep = taskMap[t.dependsOn];
    return dep && !dep.completed;
  }).length;

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

          {/* Daily Hours Cap — prominently placed in header */}
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

        {/* Stats bar */}
        <div className="stats-bar">
          <StatPill icon="📝" label="Total" value={totalTasks} />
          <StatPill icon="✅" label="Done" value={completedCount} color="green" />
          <StatPill icon="🔒" label="Blocked" value={blockedCount} color={blockedCount > 0 ? 'amber' : undefined} />
          <StatPill icon="⚠️" label="Overloaded" value={overloadedCount} color={overloadedCount > 0 ? 'red' : undefined} />
        </div>
      </header>

      <main className="app-main">
        {/* ── Overload banner ── */}
        {overloadedCount > 0 && (
          <div className="overload-banner" role="alert">
            <span className="banner-icon">⚠️</span>
            <span>
              <strong>{overloadedCount} task{overloadedCount > 1 ? 's are' : ' is'} overloaded</strong>
              {' '}— there isn't enough time before the deadline given your current daily cap and higher-priority tasks. Consider adjusting deadlines, hours, or your daily cap.
            </span>
          </div>
        )}

        {/* ── Two-column layout ── */}
        <div className="layout">
          {/* Left: Form + Table */}
          <div className="col-left">
            <TaskForm tasks={tasks} onAdd={handleAddTask} />
            <TaskTable
              tasks={tasks}
              scheduledTasks={scheduledTasks}
              taskMap={taskMap}
              onComplete={handleMarkComplete}
            />
          </div>

          {/* Right: Daily schedule */}
          <div className="col-right">
            <DailySchedule
              dailySchedule={dailySchedule}
              highlightedTaskIds={highlightedTaskIds}
            />
          </div>
        </div>
      </main>

      <footer className="app-footer">
        <p>Study Workload Scheduler — pure algorithmic scheduling, no AI</p>
      </footer>
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
