/**
 * TaskTable — shows all tasks with status, overload warning, mark-complete button.
 *
 * Props:
 *   tasks          : Task[]
 *   scheduledTasks : ScheduledTask[]   — output from runScheduler
 *   taskMap        : { [id]: Task }
 *   onComplete     : (taskId) => void
 */
export default function TaskTable({ tasks, scheduledTasks, taskMap, onComplete }) {
  // Build lookup: taskId -> scheduledTask info
  const schedMap = Object.fromEntries(
    scheduledTasks.map((st) => [st.taskId, st])
  );

  function isBlocked(task) {
    if (!task.dependsOn) return false;
    const dep = taskMap[task.dependsOn];
    return dep && !dep.completed;
  }

  function weightLabel(w) {
    const labels = ['', 'Low', 'Moderate', 'Medium', 'High', 'Critical'];
    return labels[w] || w;
  }

  function weightClass(w) {
    if (w <= 1) return 'weight-1';
    if (w <= 2) return 'weight-2';
    if (w <= 3) return 'weight-3';
    if (w <= 4) return 'weight-4';
    return 'weight-5';
  }

  const incomplete = tasks.filter((t) => !t.completed);
  const completed  = tasks.filter((t) => t.completed);

  function renderRow(task) {
    const blocked = isBlocked(task);
    const st = schedMap[task.id];
    const overloaded = st?.isOverloaded ?? false;
    const depName = task.dependsOn ? taskMap[task.dependsOn]?.name : null;

    return (
      <tr
        key={task.id}
        className={[
          task.completed ? 'row-completed' : '',
          overloaded ? 'row-overloaded' : '',
          blocked ? 'row-blocked' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {/* Name + overload badge */}
        <td className="td-name">
          <span className={task.completed ? 'task-name-done' : 'task-name'}>
            {task.name}
          </span>
          {overloaded && !task.completed && (
            <span className="badge badge-overload" title="Not enough time before deadline">
              ⚠️ Overloaded
            </span>
          )}
        </td>

        {/* Deadline */}
        <td className="td-deadline">
          {new Date(task.deadline + 'T00:00:00').toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </td>

        {/* Weight */}
        <td className="td-weight">
          <span className={`weight-pill ${weightClass(task.weight)}`}>
            {task.weight} — {weightLabel(task.weight)}
          </span>
        </td>

        {/* Hours */}
        <td className="td-hours">{task.estimatedHours}h</td>

        {/* Dependency status */}
        <td className="td-dep">
          {blocked ? (
            <span className="badge badge-blocked">🔒 Blocked by {depName}</span>
          ) : depName ? (
            <span className="badge badge-ready">✅ Dep. done</span>
          ) : (
            <span className="badge badge-none">—</span>
          )}
        </td>

        {/* Overload warning cell */}
        <td className="td-status">
          {task.completed ? (
            <span className="badge badge-done">✓ Complete</span>
          ) : overloaded ? (
            <span className="overload-warning">⚠️ Not enough time before deadline</span>
          ) : blocked ? (
            <span className="status-blocked">Waiting on dependency</span>
          ) : (
            <span className="status-scheduled">Scheduled</span>
          )}
        </td>

        {/* Actions */}
        <td className="td-action">
          {!task.completed && (
            <button
              className="btn btn-complete"
              onClick={() => onComplete(task.id)}
              aria-label={`Mark "${task.name}" as complete`}
            >
              Mark Complete
            </button>
          )}
        </td>
      </tr>
    );
  }

  return (
    <div className="task-table-wrap">
      <h2 className="section-title">📋 All Tasks</h2>
      {tasks.length === 0 ? (
        <p className="empty-msg">No tasks yet. Add one above!</p>
      ) : (
        <div className="table-scroll">
          <table className="task-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Deadline</th>
                <th>Weight</th>
                <th>Hours</th>
                <th>Dependency</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {incomplete.map(renderRow)}
              {completed.length > 0 && (
                <>
                  <tr className="tbody-divider">
                    <td colSpan={7}>
                      <span>✓ Completed ({completed.length})</span>
                    </td>
                  </tr>
                  {completed.map(renderRow)}
                </>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
