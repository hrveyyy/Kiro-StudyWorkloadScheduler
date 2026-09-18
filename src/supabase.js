import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://iijwcpmgeposmqhqcghz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_222KsNK9AbAHNRfQOvo8AQ_-8aKQQzH';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ════════════════════════════════════════════════════════════
//  Shape mappers
// ════════════════════════════════════════════════════════════

/**
 * Map a profiles row → app Profile object.
 */
function rowToProfile(row) {
  return {
    id:            row.id,
    email:         row.email,
    fullName:      row.full_name ?? '',
    dailyHoursCap: Number(row.daily_hours_cap ?? 3),
    createdAt:     row.created_at,
  };
}

/**
 * Map a tasks row → app Task object.
 * The row may include a nested `profiles` object when fetched with a join.
 */
function rowToTask(row) {
  return {
    id:             row.id,
    name:           row.name,
    deadline:       row.deadline,          // "YYYY-MM-DD"
    weight:         row.weight,
    estimatedHours: Number(row.estimated_hours),
    dependsOn:      row.depends_on ?? null,
    completed:      row.completed,
    userId:         row.user_id ?? null,
    // Joined profile info (present when fetched with select that includes profiles)
    ownerEmail:     row.profiles?.email ?? null,
    ownerName:      row.profiles?.full_name ?? null,
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

// ════════════════════════════════════════════════════════════
//  Auth helpers
// ════════════════════════════════════════════════════════════

/** Register a new user. */
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

/** Get the current session (persisted automatically by Supabase). */
export async function authGetSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session ?? null;
}

/** Subscribe to auth state changes. Returns unsubscribe fn. */
export function authOnChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => callback(session ?? null)
  );
  return () => subscription.unsubscribe();
}

// ════════════════════════════════════════════════════════════
//  Profile CRUD
// ════════════════════════════════════════════════════════════

/**
 * Load the current user's profile row.
 * The trigger we created auto-inserts a profile on signup,
 * so this should always return a row for authenticated users.
 */
export async function dbLoadProfile() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .single();

  if (error) throw error;
  return rowToProfile(data);
}

/**
 * Update profile fields (full_name and/or daily_hours_cap).
 * Only sends the fields you pass — partial update safe.
 */
export async function dbUpdateProfile(fields) {
  // fields: { fullName?, dailyHoursCap? }
  const row = {};
  if (fields.fullName      !== undefined) row.full_name       = fields.fullName;
  if (fields.dailyHoursCap !== undefined) row.daily_hours_cap = fields.dailyHoursCap;

  const { data, error } = await supabase
    .from('profiles')
    .update(row)
    .eq('id', (await supabase.auth.getUser()).data.user.id)
    .select()
    .single();

  if (error) throw error;
  return rowToProfile(data);
}

// ════════════════════════════════════════════════════════════
//  Task CRUD  (RLS-scoped to the authenticated user)
// ════════════════════════════════════════════════════════════

/**
 * Load all tasks for the current user.
 * Joins profiles so each task carries ownerEmail / ownerName —
 * makes the Supabase table view much more readable.
 */
export async function dbLoadTasks() {
  const { data, error } = await supabase
    .from('tasks')
    .select(`
      *,
      profiles (
        email,
        full_name
      )
    `)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data.map(rowToTask);
}

/** Insert a new task row. */
export async function dbAddTask(task, userId) {
  const { data, error } = await supabase
    .from('tasks')
    .insert(taskToRow(task, userId))
    .select(`
      *,
      profiles (
        email,
        full_name
      )
    `)
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
    .select(`
      *,
      profiles (
        email,
        full_name
      )
    `)
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
    .select(`
      *,
      profiles (
        email,
        full_name
      )
    `)
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
