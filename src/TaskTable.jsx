import { useState, useMemo } from 'react';
import { toDateStr, today } from './scheduler.js';

/**
 * TaskTable — desktop shows a full table; mobile (<768px) shows task cards.
 */
export default function TaskTable({ tasks, scheduledTasks, taskMap, onComplete, onEdit, onDelete }) {
  const [filter, setFilter] = useState('all');
  const [sort,   setSort]   = useState('deadline');
  const [showCompleted, setShowCompleted] = useState(true);

  const todayStr = toDateStr(today());

  const schedMap = useMemo(
    () => Object.fromEntries(scheduledTasks.map((st) => [st.taskId, st])),
    [scheduledTasks]
  );

  function isBlocked(task) {
    if (!task.dependsOn) return false;
    const dep = taskMap[task.dependsOn];
    return dep && !dep.completed;
  }

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = tasks.filter((t) => showCompleted ? true : !t.completed);
    switch (filter) {
      case 'today':      return list.filter((t) => t.deadline === todayStr && !t.completed);
      case 'overloaded': return list.filter((t) => schedMap[t.id]?.isOverloaded && !t.completed);
      case 'blocked':    return list.filter((t) => isBlocked(t) && !t.completed);
      default:           return list;
    }
  }, [tasks, filter, showCompleted, schedMap, todayStr]);

  // ── Sort ──────────────────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    const incomplete = filtered.filter((t) => !t.completed);
    const completed  = filtered.filter((t) =>  t.completed);

    function sortFn(a, b) {
      switch (sort) {
        case 'weight':
          if (b.weight !== a.weight) return b.weight - a.weight;
          return new Date(a.deadline) - new Date(b.deadline);
        case 'name':
          return a.name.localeCompare(b.name);
        case 'deadline':
        default: {
          const dd = new Date(a.deadline) - new Date(b.deadline);
          return dd !== 0 ? dd : b.weight - a.weight;
        }
      }
    }
    return [...incomplete.sort(sortFn), ...completed];
  }, [filtered, sort]);

  // ── Count badges ──────────────────────────────────────────────────────────
  const counts = useMemo(() => ({
    all:        tasks.filter((t) => !t.completed).length,
    today:      tasks.filter((t) => t.deadline === todayStr && !t.completed).length,
    overloaded: tasks.filter((t) => schedMap[t.id]?.isOverloaded && !t.completed).length,
    blocked:    tasks.filter((t) => isBlocked(t) && !t.completed).length,
  }), [tasks, schedMap, todayStr]);

  // ── Shared helpers ────────────────────────────────────────────────────────
  function weightLabel(w) {
    return ['', 'Low', 'Moderate', 'Medium', 'High', 'Critical'][w] ?? w;
  }
  function weightClass(w) {
    return ['', 'weight-1', 'weight-2', 'weight-3', 'weight-4', 'weight-5'][w] ?? 'weight-3';
  }
  function dotClass(w) {
    return ['', 'weight-1', 'weight-2', 'weight-3', 'weight-4', 'weight-5'][w] ?? 'weight-3';
  }
  function deadlineUrgency(deadline, completed) {
    if (completed) return '';
    const diff = Math.ceil(
      (new Date(deadline + 'T00:00:00') - new Date(todayStr + 'T00:00:00')) / 86400000
    );
    if (diff < 0)   return 'deadline-past';
    if (diff === 0) return 'deadline-today';
    if (diff <= 2)  return 'deadline-soon';
    return '';
  }
  function formatDeadline(deadline) {
    const d    = new Date(deadline + 'T00:00:00');
    const diff = Math.ceil((d - new Date(todayStr + 'T00:00:00')) / 86400000);
    const base = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    if (diff < 0)   return `${base} (overdue)`;
    if (diff === 0) return `${base} (today)`;
    if (diff === 1) return `${base} (tomorrow)`;
    if (diff <= 7)  return `${base} (in ${diff}d)`;
    return base;
  }

  const incompleteRows = sorted.filter((t) => !t.completed);
  const completedRows  = sorted.filter((t) =>  t.completed);
  const totalCompleted = tasks.filter((t) => t.completed).length;

  // ── Empty state ───────────────────────────────────────────────────────────
  const emptyMessage =
    filter === 'today'      ? 'No tasks due today.' :
    filter === 'overloaded' ? "No overloaded tasks — you're on track!" :
    filter === 'blocked'    ? 'No blocked tasks.' :
    'No tasks yet. Click "➕ Add Task" to get started!';

  const emptyIcon =
    filter === 'today' ? '🗓️' : filter === 'overloaded' ? '✅' :
    filter === 'blocked' ? '🔓' : '📭';

  // ── Toolbar (shared) ──────────────────────────────────────────────────────
  const toolbar = (
    <div className="table-toolbar">
      <h2 className="section-title" style={{ marginBottom: 0 }}>📋 All Tasks</h2>
      <div className="toolbar-right">
        <div className="filter-group" role="group" aria-label="Filter tasks">
          <FilterBtn label="All"        count={counts.all}        active={filter==='all'}        onClick={() => setFilter('all')} />
          <FilterBtn label="Due Today"  count={counts.today}      active={filter==='today'}      onClick={() => setFilter('today')}      color="amber" />
          <FilterBtn label="Overloaded" count={counts.overloaded} active={filter==='overloaded'} onClick={() => setFilter('overloaded')} color="red" />
          <FilterBtn label="Blocked"    count={counts.blocked}    active={filter==='blocked'}    onClick={() => setFilter('blocked')}    color="gray" />
        </div>
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
  );

  // ── Empty ─────────────────────────────────────────────────────────────────
  if (sorted.length === 0) {
    return (
      <div className="task-table-wrap">
        {toolbar}
        <div className="empty-filter-state">
          <span className="empty-filter-icon">{emptyIcon}</span>
          <p>{emptyMessage}</p>
        </div>
      </div>
    );
  }

  // ── Desktop table row renderer ────────────────────────────────────────────
  function renderTableRow(task) {
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
        {/* Priority dot */}
        <td className="td-priority">
          {!task.completed && (
            <span
              className={`priority-dot ${dotClass(task.weight)}`}
              title={`Weight ${task.weight} — ${weightLabel(task.weight)}`}
            />
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

        {/* Depends on */}
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
                <button className="btn btn-edit"     onClick={() => onEdit(task)}         title="Edit">✏️</button>
                <button className="btn btn-complete" onClick={() => onComplete(task.id)}  title="Mark complete">✓</button>
              </>
            )}
            <button
              className="btn btn-delete"
              onClick={() => { if (window.confirm(`Delete "${task.name}"?`)) onDelete(task.id); }}
              title="Delete"
            >🗑</button>
          </div>
        </td>
      </tr>
    );
  }

  // ── Mobile card renderer ──────────────────────────────────────────────────
  function renderCard(task) {
    const blocked    = isBlocked(task);
    const st         = schedMap[task.id];
    const overloaded = st?.isOverloaded ?? false;
    const depName    = task.dependsOn ? taskMap[task.dependsOn]?.name : null;
    const urgency    = deadlineUrgency(task.deadline, task.completed);

    return (
      <div
        key={task.id}
        className={[
          'task-card',
          task.completed ? 'card-completed'  : '',
          overloaded     ? 'card-overloaded' : '',
          blocked        ? 'card-blocked'    : '',
        ].filter(Boolean).join(' ')}
      >
        {/* Header: dot + name + inline badges */}
        <div className="card-header">
          {!task.completed && (
            <span className={`card-dot priority-dot ${dotClass(task.weight)}`} />
          )}
          <div className="card-name-wrap">
            <span className={task.completed ? 'card-name-done' : 'card-name'}>
              {task.name}
            </span>
            <div className="card-badges">
              {task.completed ? (
                <span className="badge badge-done">✓ Done</span>
              ) : overloaded ? (
                <span className="badge badge-warn">⚠️ Overloaded</span>
              ) : blocked ? (
                <span className="badge badge-blocked">🔒 Blocked</span>
              ) : (
                <span className="badge badge-scheduled">● Scheduled</span>
              )}
              <span className={`weight-pill ${weightClass(task.weight)}`}>
                {task.weight} — {weightLabel(task.weight)}
              </span>
            </div>
          </div>
        </div>

        {/* Meta grid */}
        <div className="card-meta">
          <div className="card-meta-item">
            <span className="card-meta-label">Deadline</span>
            <span className={`card-meta-value deadline-text ${urgency}`}>
              {formatDeadline(task.deadline)}
            </span>
          </div>
          <div className="card-meta-item">
            <span className="card-meta-label">Hours</span>
            <span className="card-meta-value">{task.estimatedHours}h estimated</span>
          </div>
          {depName && (
            <div className="card-meta-item">
              <span className="card-meta-label">Depends On</span>
              <span className={`card-meta-value ${blocked ? 'dep-blocked' : 'dep-done'}`}>
                {blocked ? '🔒 ' : '✅ '}{depName}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="card-actions">
          {!task.completed && (
            <>
              <button className="btn btn-edit"     onClick={() => onEdit(task)}>✏️ Edit</button>
              <button className="btn btn-complete" onClick={() => onComplete(task.id)}>✓ Done</button>
            </>
          )}
          <button
            className="btn btn-delete"
            onClick={() => { if (window.confirm(`Delete "${task.name}"?`)) onDelete(task.id); }}
          >🗑 Delete</button>
        </div>
      </div>
    );
  }

  // ── Final render ──────────────────────────────────────────────────────────
  return (
    <div className="task-table-wrap">
      {toolbar}

      {/* ── Desktop table (hidden on mobile via CSS) ── */}
      <div className="table-scroll desktop-only">
        <table className="task-table">
          <thead>
            <tr>
              <th className="th-priority" aria-label="Priority" />
              <th className="th-name">Task {sort === 'name' && <SortIcon />}</th>
              <th className="th-deadline">Deadline {sort === 'deadline' && <SortIcon />}</th>
              <th className="th-weight">Weight {sort === 'weight' && <SortIcon />}</th>
              <th className="th-hours">Hours</th>
              <th className="th-status">Status</th>
              <th className="th-dep">Depends On</th>
              <th className="th-action">Actions</th>
            </tr>
          </thead>
          <tbody>
            {incompleteRows.map(renderTableRow)}
            {showCompleted && completedRows.length > 0 && (
              <>
                <tr className="tbody-divider">
                  <td colSpan={8}>✓ Completed ({totalCompleted})</td>
                </tr>
                {completedRows.map(renderTableRow)}
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Mobile cards (hidden on desktop via CSS) ── */}
      <div className="task-card-list mobile-only">
        {incompleteRows.map(renderCard)}
        {showCompleted && completedRows.length > 0 && (
          <>
            <div className="card-section-divider">✓ Completed ({totalCompleted})</div>
            {completedRows.map(renderCard)}
          </>
        )}
      </div>
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
