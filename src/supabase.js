import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://iijwcpmgeposmqhqcghz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_222KsNK9AbAHNRfQOvo8AQ_-8aKQQzH';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Shape mapping ────────────────────────────────────────────────────────────

function rowToTask(row) {
  return {
    id:             row.id,
    name:           row.name,
    deadline:       row.deadline,
    weight:         row.weight,
    estimatedHours: row.estimated_hours,
    dependsOn:      row.depends_on ?? null,
    completed:      row.completed,
  };
}

function taskToRow(task, userId) {
  return {
    id:              task.id,
    name:            task.name,
    deadline:        task.deadline,
    weight:          task.weight,
    estimated_hours: task.estimatedHours,
    depends_on:      task.dependsOn ?? null,
    completed:       task.completed,
    user_id:         userId,
  };
}

// ── Auth helpers ─────────────────────────────────────────────────────────────

/** Register a new user with email + password. */
export async function authSignUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

/** Sign in an existing user. */
export async function authSignIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/** Sign out the current user. */
export async function authSignOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Get the current session. Returns { session, user } or null.
 * Supabase automatically persists + refreshes the session in localStorage.
 */
export async function authGetSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session; // null if not logged in
}

/**
 * Subscribe to auth state changes.
 * Returns an unsubscribe function.
 */
export function authOnChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => callback(session)
  );
  return () => subscription.unsubscribe();
}

// ── Task CRUD (all scoped to authenticated user via RLS) ─────────────────────

/** Load all tasks for the current user. */
export async function dbLoadTasks() {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data.map(rowToTask);
}

/** Insert a new task. userId is attached so RLS insert policy is satisfied. */
export async function dbAddTask(task, userId) {
  const { data, error } = await supabase
    .from('tasks')
    .insert(taskToRow(task, userId))
    .select()
    .single();

  if (error) throw error;
  return rowToTask(data);
}

/** Update an existing task. */
export async function dbUpdateTask(task, userId) {
  const { data, error } = await supabase
    .from('tasks')
    .update(taskToRow(task, userId))
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

/** Delete a task. */
export async function dbDeleteTask(taskId) {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId);

  if (error) throw error;
}
