import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://iijwcpmgeposmqhqcghz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_222KsNK9AbAHNRfQOvo8AQ_-8aKQQzH';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Row <-> Task shape mapping ───────────────────────────────────────────────
// DB columns use snake_case; the app uses camelCase.

function rowToTask(row) {
  return {
    id:             row.id,
    name:           row.name,
    deadline:       row.deadline,          // stored as "YYYY-MM-DD"
    weight:         row.weight,
    estimatedHours: row.estimated_hours,
    dependsOn:      row.depends_on ?? null,
    completed:      row.completed,
  };
}

function taskToRow(task) {
  return {
    id:              task.id,
    name:            task.name,
    deadline:        task.deadline,
    weight:          task.weight,
    estimated_hours: task.estimatedHours,
    depends_on:      task.dependsOn ?? null,
    completed:       task.completed,
  };
}

// ── CRUD helpers ─────────────────────────────────────────────────────────────

/** Load all tasks ordered by creation time. */
export async function dbLoadTasks() {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data.map(rowToTask);
}

/** Insert a new task row. */
export async function dbAddTask(task) {
  const { data, error } = await supabase
    .from('tasks')
    .insert(taskToRow(task))
    .select()
    .single();

  if (error) throw error;
  return rowToTask(data);
}

/** Update an existing task (any fields). */
export async function dbUpdateTask(task) {
  const { data, error } = await supabase
    .from('tasks')
    .update(taskToRow(task))
    .eq('id', task.id)
    .select()
    .single();

  if (error) throw error;
  return rowToTask(data);
}

/** Mark a task completed. */
export async function dbCompleteTask(taskId) {
  const { data, error } = await supabase
    .from('tasks')
    .update({ completed: true })
    .eq('id', taskId)
    .select()
    .single();

  if (error) throw error;
  return rowToTask(data);
}

/** Delete a task by id. */
export async function dbDeleteTask(taskId) {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId);

  if (error) throw error;
}
