import { useState } from 'react';
import { today, toDateStr } from './scheduler.js';

const EMPTY_FORM = {
  name: '',
  deadline: '',
  weight: 3,
  estimatedHours: '',
  dependsOn: '',
};

/**
 * TaskForm — Add a new task.
 * Props:
 *   tasks    : Task[]        — existing tasks (for dependency dropdown)
 *   onAdd    : (task) => void
 */
export default function TaskForm({ tasks, onAdd }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});

  const todayStr = toDateStr(today());

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validate() {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Task name is required.';
    if (!form.deadline) errs.deadline = 'Deadline is required.';
    const hrs = parseFloat(form.estimatedHours);
    if (!form.estimatedHours || isNaN(hrs) || hrs <= 0)
      errs.estimatedHours = 'Enter a positive number of hours.';
    return errs;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    const newTask = {
      id: `task-${Date.now()}`,
      name: form.name.trim(),
      deadline: form.deadline,
      weight: Number(form.weight),
      estimatedHours: parseFloat(form.estimatedHours),
      dependsOn: form.dependsOn || null,
      completed: false,
    };

    onAdd(newTask);
    setForm(EMPTY_FORM);
    setErrors({});
  }

  return (
    <form className="task-form" onSubmit={handleSubmit} noValidate>
      <h2 className="form-title">➕ Add New Task</h2>

      <div className="form-grid">
        {/* Name */}
        <div className="form-field">
          <label htmlFor="tf-name">Task Name</label>
          <input
            id="tf-name"
            type="text"
            placeholder="e.g. Math Review"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            className={errors.name ? 'input-error' : ''}
          />
          {errors.name && <span className="error-msg">{errors.name}</span>}
        </div>

        {/* Deadline */}
        <div className="form-field">
          <label htmlFor="tf-deadline">Deadline</label>
          <input
            id="tf-deadline"
            type="date"
            min={todayStr}
            value={form.deadline}
            onChange={(e) => set('deadline', e.target.value)}
            className={errors.deadline ? 'input-error' : ''}
          />
          {errors.deadline && <span className="error-msg">{errors.deadline}</span>}
        </div>

        {/* Weight */}
        <div className="form-field">
          <label htmlFor="tf-weight">
            Difficulty / Importance
            <span className="weight-badge" data-weight={form.weight}>
              {form.weight}
            </span>
          </label>
          <input
            id="tf-weight"
            type="range"
            min="1"
            max="5"
            step="1"
            value={form.weight}
            onChange={(e) => set('weight', e.target.value)}
            className="weight-slider"
          />
          <div className="weight-labels">
            <span>1 Easy</span>
            <span>5 Critical</span>
          </div>
        </div>

        {/* Estimated Hours */}
        <div className="form-field">
          <label htmlFor="tf-hours">Estimated Hours</label>
          <input
            id="tf-hours"
            type="number"
            min="0.5"
            step="0.5"
            placeholder="e.g. 3"
            value={form.estimatedHours}
            onChange={(e) => set('estimatedHours', e.target.value)}
            className={errors.estimatedHours ? 'input-error' : ''}
          />
          {errors.estimatedHours && (
            <span className="error-msg">{errors.estimatedHours}</span>
          )}
        </div>

        {/* Depends On */}
        <div className="form-field">
          <label htmlFor="tf-depends">Depends On (optional)</label>
          <select
            id="tf-depends"
            value={form.dependsOn}
            onChange={(e) => set('dependsOn', e.target.value)}
          >
            <option value="">— None —</option>
            {tasks
              .filter((t) => !t.completed)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      <button type="submit" className="btn btn-primary">
        Add Task
      </button>
    </form>
  );
}
