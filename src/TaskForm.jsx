import { useState, useEffect } from 'react';
import { today, toDateStr } from './scheduler.js';

const EMPTY_FORM = {
  name: '',
  deadline: '',
  weight: 3,
  estimatedHours: '',
  dependsOn: '',
};

/**
 * TaskFormModal — modal dialog for Add and Edit.
 *
 * Props:
 *   isOpen    : boolean
 *   editTask  : Task | null   — null = Add mode, Task = Edit mode
 *   tasks     : Task[]        — all tasks (for dependency dropdown)
 *   onSave    : (task) => void
 *   onClose   : () => void
 *   isSaving  : boolean
 */
export default function TaskFormModal({ isOpen, editTask, tasks, onSave, onClose, isSaving }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const todayStr = toDateStr(today());
  const isEditing = Boolean(editTask);

  // Populate form when switching between add/edit
  useEffect(() => {
    if (editTask) {
      setForm({
        name:           editTask.name,
        deadline:       editTask.deadline,
        weight:         editTask.weight,
        estimatedHours: String(editTask.estimatedHours),
        dependsOn:      editTask.dependsOn ?? '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setErrors({});
  }, [editTask, isOpen]);

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
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    const task = {
      id:             isEditing ? editTask.id : `task-${Date.now()}`,
      name:           form.name.trim(),
      deadline:       form.deadline,
      weight:         Number(form.weight),
      estimatedHours: parseFloat(form.estimatedHours),
      dependsOn:      form.dependsOn || null,
      completed:      isEditing ? editTask.completed : false,
    };

    onSave(task);
  }

  function handleBackdropClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  if (!isOpen) return null;

  // Tasks available for dependency (exclude self when editing)
  const dependencyOptions = tasks.filter(
    (t) => !t.completed && (!isEditing || t.id !== editTask?.id)
  );

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal">
        {/* Header */}
        <div className="modal-header">
          <h2 id="modal-title" className="modal-title">
            {isEditing ? '✏️ Edit Task' : '➕ Add New Task'}
          </h2>
          <button className="modal-close" onClick={onClose} aria-label="Close" disabled={isSaving}>✕</button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="modal-body">
            <div className="form-grid">

              {/* Name */}
              <div className="form-field form-field-full">
                <label htmlFor="tf-name">Task Name</label>
                <input
                  id="tf-name"
                  type="text"
                  placeholder="e.g. Math Review"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  className={errors.name ? 'input-error' : ''}
                  autoFocus
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
                {errors.estimatedHours && <span className="error-msg">{errors.estimatedHours}</span>}
              </div>

              {/* Weight */}
              <div className="form-field form-field-full">
                <label htmlFor="tf-weight">
                  Difficulty / Importance
                  <span className="weight-badge" data-weight={form.weight}>{form.weight}</span>
                </label>
                <input
                  id="tf-weight"
                  type="range"
                  min="1" max="5" step="1"
                  value={form.weight}
                  onChange={(e) => set('weight', e.target.value)}
                  className="weight-slider"
                />
                <div className="weight-labels">
                  <span>1 Easy</span>
                  <span>5 Critical</span>
                </div>
              </div>

              {/* Depends On */}
              <div className="form-field form-field-full">
                <label htmlFor="tf-depends">Depends On (optional)</label>
                <select
                  id="tf-depends"
                  value={form.dependsOn}
                  onChange={(e) => set('dependsOn', e.target.value)}
                >
                  <option value="">— None —</option>
                  {dependencyOptions.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

            </div>
          </div>

          {/* Footer */}
          <div className="modal-footer">
            <button type="button" className="btn btn-cancel" onClick={onClose} disabled={isSaving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              {isSaving ? 'Saving…' : isEditing ? 'Save Changes' : 'Add Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
