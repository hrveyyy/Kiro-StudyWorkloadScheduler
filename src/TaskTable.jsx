import { useState, useMemo } from 'react';
import { toDateStr, today } from './scheduler.js';

/**
 * TaskTable — task list with filter/sort toolbar.
 *
 * Props:
 *   tasks          : Task[]
 *   scheduledTasks : ScheduledTask[]
 *   taskMap        : { [id]: Task }
 *   onComplete     : (taskId) => void
 *   onEdit         : (task)   => void
 *   onDelete       : (taskId) => void
 */
export default function TaskTable({ tasks, scheduledTasks, taskMap, onComplete, onEdit, onDelete }) {
  const [filter, setFilter] = useState('all');      // 'all' | 'today' | 'overloaded' | 'blocked'
  const [sort,   setSort]   = useState('deadline'); // 'deadline' | 'weight' | 'name'
  const [showCompleted, setShowCompleted] = useState(true);

  const todayStr = toDateStr(today());

  const schedMap = useMemo(() =>
    Object.fromEntries(scheduledTasks.map((st) => [st.taskId, st])),
    [scheduledTasks]
  );

  function isBlocked(task) {
    if (!task.dependsOn) return false;
    const dep = taskMap[task.dependsOn];
    return dep && !dep.completed;
  }

  // ── Apply filter ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = tasks.filter((t) => showCompleted ? true : !t.completed);

    switch (filter) {
      case 'today':
        list = list.filter((t) => t.deadline === todayStr && !t.completed);
        break;
      case 'overloaded':
        list = list.filter((t) => schedMap[t.id]?.isOverloaded && !t.completed);
        break;
      case 'blocked':
        list = list.filter((t) => isBlocked(t) && !t.completed);
        break;
      default:
        break;
    }
    return list;
  }, [tasks, filter, showCompleted, schedMap, todayStr]);

  // ── Apply sort ──────────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    const incomplete = filtered.filter((t) => !t.completed);
    const completed  = filtered.filter((t) =>  t.completed);

    function sortFn(a, b) {
      switch (sort) {
        case 'weight':
          // Highest weight first, then earliest deadline
          if (b.weight !== a.weight) return b.weight - a.weight;
          return new Date(a.deadline) - new Date(b.deadline);
        case 'name':
          return a.name.localeCompare(b.name);
        case 'deadline':
        default:
          // Earliest deadline first, then highest weight
          const dd = new Date(a.deadline) - new Date(b.deadline);
          if (dd !== 0) return dd;
          return b.weight - a.weight;
      }
    }

    return [...incomplete.sort(sortFn), ...completed];
  }, [filtered, sort]);

  // ── Count badges for filter buttons ────────────────────────────────────
  const counts = useMemo(() => ({
    all:       tasks.filter((t) => !t.completed).length,
    today:     tasks.filter((t) => t.deadline === todayStr && !t.completed).length,
    overloaded:tasks.filter((t) => schedMap[t.id]?.isOverloaded && !t.completed).length,
    blocked:   tasks.filter((t) => isBlocked(t) && !t.completed).length,
  }), [tasks, schedMap, todayStr]);

  // ── Helpers ─────────────────────────────────────────────────────────────
  function weightLabel(w) {
    return ['', 'Low', 'Moderate', 'Medium', 'High', 'Critical'][w] ?? w;
  }
  function weightClass(w) {
    return ['', 'weight-1', 'weight-2', 'weight-3', 'weight-4', 'weight-5'][w] ?? 'weight-3';
  }

  function deadlineUrgency(deadline, completed) {
    if (completed) return '';
    const diff = Math.ceil((new Date(deadline + 'T00:00:00') - new Date(todayStr + 'T00:00:00')) / 86400000);
    if (diff < 0)  return 'deadline-past';
    if (diff === 0) return 'deadline-today';
    if (diff <= 2)  return 'deadline-soon';
    return '';
  }

  function formatDeadline(deadline) {
    const d = new Date(deadline + 'T00:00:00');
    const diff = Math.ceil((d - new Date(todayStr + 'T00:00:00')) / 86400000);
    const base = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    if (diff < 0)   return `${base} (overdue)`;
    if (diff === 0) return `${base} (today)`;
    if (diff === 1) return `${base} (tomorrow)`;
    if (diff <= 7)  return `${base} (in ${diff}d)`;
    return base;
  }

  // ── Render row ──────────────────────────────────────────────────────────
  function renderRow(task) {
    const blocked    = isBlocked(task);
    const st         = schedMap[task.id];
    const overloaded = st?.isOverloaded ?? false;
    const depName    = task.dependsOn ? taskMap[task.dependsOn]?.name : null;
    const urgency    = deadlineUrgency(task.deadline, task.completed);

    return (
      <tr
        key={task.id}
        className={[
          task.completed ? 'row-completed'  : '',
          overloaded     ? 'row-overloaded' : '',
          blocked        ? 'row-blocked'    : '',
        ].filter(Boolean).join(' ')}
      >
        {/* # priority indicator */}
        <td className="td-priority">
          {!task.completed && (
            <span className={`priority-dot ${weightClass(task.weight)}`} title={`Weight ${task.weight} — ${weightLabel(task.weight)}`} />
          )}
        </td>

        {/* Name */}
        <td className="td-name">
          <span className={task.completed ? 'task-name-done' : 'task-name'}>
            {task.name}
          </span>
          {overloaded && !task.completed && (
            <span className="badge badge-overload" title="Not enough time before deadline">⚠️</span>
          )}
          {blocked && !task.completed && (
            <span className="badge badge-blocked-sm" title={`Blocked by ${depName}`}>🔒</span>
          )}
        </td>

        {/* Deadline */}
        <td className={`td-deadline ${urgency}`}>
          <span className="deadline-text">{formatDeadline(task.deadline)}</span>
        </td>

        {/* Weight */}
        <td className="td-weight">
          <span className={`weight-pill ${weightClass(task.weight)}`}>
            {task.weight} — {weightLabel(task.weight)}
          </span>
        </td>

        {/* Hours */}
        <td className="td-hours">
          <span className="hours-badge">{task.estimatedHours}h</span>
        </td>

        {/* Status */}
        <td className="td-status">
          {task.completed ? (
            <span className="badge badge-done">✓ Done</span>
          ) : overloaded ? (
            <span className="badge badge-warn">⚠️ Overloaded</span>
          ) : blocked ? (
            <span className="badge badge-blocked">🔒 Blocked</span>
          ) : (
            <span className="badge badge-scheduled">● Scheduled</span>
          )}
        </td>

        {/* Dependency */}
        <td className="td-dep">
          {depName
            ? <span className={`dep-name ${blocked ? 'dep-blocked' : 'dep-done'}`}>{depName}</span>
            : <span className="dep-none">—</span>}
        </td>

        {/* Actions */}
        <td className="td-action">
          <div className="action-group">
            {!task.completed && (
              <>
                <button className="btn btn-edit"     onClick={() => onEdit(task)}    title="Edit task">✏️</button>
                <button className="btn btn-complete" onClick={() => onComplete(task.id)} title="Mark complete">✓</button>
              </>
            )}
            <button
              className="btn btn-delete"
              onClick={() => { if (window.confirm(`Delete "${task.name}"?`)) onDelete(task.id); }}
              title="Delete task"
            >🗑</button>
          </div>
        </td>
      </tr>
    );
  }

  const incompleteRows = sorted.filter((t) => !t.completed);
  const completedRows  = sorted.filter((t) =>  t.completed);
  const totalCompleted = tasks.filter((t) => t.completed).length;

  return (
    <div className="task-table-wrap">
      {/* ── Toolbar ── */}
      <div className="table-toolbar">
        <h2 className="section-title" style={{ marginBottom: 0 }}>📋 All Tasks</h2>

        <div className="toolbar-right">
          {/* Filter buttons */}
          <div className="filter-group" role="group" aria-label="Filter tasks">
            <FilterBtn label="All" count={counts.all}       active={filter === 'all'}       onClick={() => setFilter('all')} />
            <FilterBtn label="Due Today" count={counts.today}     active={filter === 'today'}     onClick={() => setFilter('today')}     color="amber" />
            <FilterBtn label="Overloaded" count={counts.overloaded} active={filter === 'overloaded'} onClick={() => setFilter('overloaded')} color="red" />
            <FilterBtn label="Blocked"   count={counts.blocked}    active={filter === 'blocked'}    onClick={() => setFilter('blocked')}   color="gray" />
          </div>

          {/* Sort select */}
          <div className="sort-group">
            <label htmlFor="sort-select" className="sort-label">Sort by</label>
            <select
              id="sort-select"
              className="sort-select"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="deadline">Deadline</option>
              <option value="weight">Weight (Critical first)</option>
              <option value="name">Name (A–Z)</option>
            </select>
          </div>

          {/* Show/hide completed toggle */}
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
              className="toggle-checkbox"
            />
            Show completed
          </label>
        </div>
      </div>

      {/* ── Table ── */}
      {sorted.length === 0 ? (
        <div className="empty-filter-state">
          <span className="empty-filter-icon">
            {filter === 'today' ? '🗓️' : filter === 'overloaded' ? '✅' : filter === 'blocked' ? '🔓' : '📭'}
          </span>
          <p>
            {filter === 'today'      ? 'No tasks due today.' :
             filter === 'overloaded' ? 'No overloaded tasks — you\'re on track!' :
             filter === 'blocked'    ? 'No blocked tasks.' :
             'No tasks yet. Click "➕ Add Task" to get started!'}
          </p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="task-table">
            <thead>
              <tr>
                <th className="th-priority" aria-label="Priority"></th>
                <th className="th-name">
                  Task
                  {sort === 'name' && <SortIcon />}
                </th>
                <th className="th-deadline">
                  Deadline
                  {sort === 'deadline' && <SortIcon />}
                </th>
                <th className="th-weight">
                  Weight
                  {sort === 'weight' && <SortIcon />}
                </th>
                <th className="th-hours">Hours</th>
                <th className="th-status">Status</th>
                <th className="th-dep">Depends On</th>
                <th className="th-action">Actions</th>
              </tr>
            </thead>
            <tbody>
              {incompleteRows.map(renderRow)}

              {showCompleted && completedRows.length > 0 && (
                <>
                  <tr className="tbody-divider">
                    <td colSpan={8}>✓ Completed ({totalCompleted})</td>
                  </tr>
                  {completedRows.map(renderRow)}
                </>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterBtn({ label, count, active, onClick, color }) {
  return (
    <button
      type="button"
      className={`filter-btn ${active ? 'filter-btn-active' : ''} ${color ? `filter-btn-${color}` : ''}`}
      onClick={onClick}
    >
      {label}
      {count > 0 && <span className="filter-count">{count}</span>}
    </button>
  );
}

function SortIcon() {
  return <span className="sort-icon" aria-hidden="true">↑</span>;
}
