/**
 * Study Workload Scheduler — Core Algorithm
 * Pure algorithmic greedy priority-queue scheduler. No AI/LLM.
 */

/**
 * Returns a Date object for "today" normalized to midnight local time.
 */
export function today() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Add `n` calendar days to a Date, returning a new Date at midnight.
 */
export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Number of whole calendar days from today (midnight) to the given deadline date.
 * Minimum 0 (already past or today).
 */
export function daysUntilDeadline(deadlineStr) {
  const t = today();
  const dl = new Date(deadlineStr);
  dl.setHours(0, 0, 0, 0);
  const diff = Math.floor((dl - t) / (1000 * 60 * 60 * 24));
  return Math.max(diff, 0);
}

/**
 * Format a Date as "YYYY-MM-DD" string (local).
 */
export function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Format a Date as a friendly display string, relative to today.
 *   today   → "Today (Mon, Oct 3)"
 *   +1 day  → "Tomorrow (Tue, Oct 4)"
 *   else    → "Wed, Oct 5"
 */
export function formatDayLabel(date) {
  const t = today();
  const diff = Math.round((date - t) / (1000 * 60 * 60 * 24));
  const short = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  if (diff === 0) return `Today (${short})`;
  if (diff === 1) return `Tomorrow (${short})`;
  return short;
}

/**
 * Main scheduler function.
 *
 * @param {Task[]} tasks        - Full task list (all tasks).
 * @param {number} dailyHoursCap - Daily study hours available.
 * @returns {ScheduleResult}
 *
 * ScheduleResult = {
 *   scheduledTasks: Array<{ taskId, allocations: [{date, hours}], startDate, isOverloaded }>,
 *   dailySchedule:  Array<{ date, dateStr, label, entries: [{taskId, taskName, hours}] }>,
 * }
 */
export function runScheduler(tasks, dailyHoursCap) {
  const cap = Math.max(dailyHoursCap || 0, 0);

  // ── 1. Determine blocked status ──────────────────────────────────────────
  const completedIds = new Set(tasks.filter((t) => t.completed).map((t) => t.id));

  const taskMap = Object.fromEntries(tasks.map((t) => [t.id, t]));

  function isBlocked(task) {
    if (!task.dependsOn) return false;
    // blocked if the dependency task exists AND is not completed
    return taskMap[task.dependsOn] && !completedIds.has(task.dependsOn);
  }

  // ── 2. Sort unblocked, incomplete tasks by priority ──────────────────────
  //   a) Earlier deadline first
  //   b) Tie-break: higher weight first
  const eligible = tasks
    .filter((t) => !t.completed && !isBlocked(t))
    .sort((a, b) => {
      const da = new Date(a.deadline).getTime();
      const db = new Date(b.deadline).getTime();
      if (da !== db) return da - db;          // earlier deadline first
      return b.weight - a.weight;             // higher weight first
    });

  // ── 3. Greedy day-bucket allocation ─────────────────────────────────────
  if (cap === 0) {
    // Edge case: no hours available — everything gets no allocation
    const scheduledTasks = eligible.map((task) => ({
      taskId: task.id,
      allocations: [],
      startDate: null,
      isOverloaded: true,
    }));
    return { scheduledTasks, dailySchedule: [] };
  }

  // dayBuckets: Map<dateStr, remainingCapacity>
  const dayBuckets = new Map();

  function getBucketRemaining(dateStr) {
    if (!dayBuckets.has(dateStr)) dayBuckets.set(dateStr, cap);
    return dayBuckets.get(dateStr);
  }

  function consumeBucket(dateStr, hours) {
    dayBuckets.set(dateStr, getBucketRemaining(dateStr) - hours);
  }

  const t0 = today();
  // We allocate starting from today (index 0).
  // currentDayOffset tracks which day we're currently filling.
  let currentDayOffset = 0;

  /**
   * Allocate `hoursNeeded` starting from the current position,
   * returns array of {date, hours} segments.
   */
  function allocateHours(hoursNeeded) {
    const allocs = [];
    let remaining = hoursNeeded;

    while (remaining > 0) {
      const date = addDays(t0, currentDayOffset);
      const dateStr = toDateStr(date);
      let avail = getBucketRemaining(dateStr);

      if (avail <= 0) {
        // This day is full, advance
        currentDayOffset++;
        continue;
      }

      const used = Math.min(avail, remaining);
      consumeBucket(dateStr, used);
      allocs.push({ date, dateStr, hours: used });
      remaining = Math.round((remaining - used) * 1000) / 1000; // float safety

      if (getBucketRemaining(dateStr) <= 0) {
        currentDayOffset++;
      }
    }

    return allocs;
  }

  const scheduledTasks = [];

  for (const task of eligible) {
    const allocs = allocateHours(task.estimatedHours);
    const startDate = allocs.length > 0 ? allocs[0].date : null;
    scheduledTasks.push({ taskId: task.id, allocations: allocs, startDate, isOverloaded: false });
  }

  // ── 4. Overload detection ────────────────────────────────────────────────
  // For each task: is there enough capacity between today and its deadline
  // to fit its hours, given higher-priority tasks that consume that window?
  //
  // We replay the priority order: for each task in position i, count how many
  // hours the tasks before it (higher priority) consume in the window
  // [today .. deadline_i], then check if the remaining capacity fits task i.

  // Build cumulative hours-per-date consumed by tasks ahead in the queue.
  // We iterate in priority order and track a running "hours consumed before deadline" map.

  // hoursConsumedUpTo(deadline): sum of all allocated hours by earlier tasks
  // that fall within [today .. deadline].
  const cumulativeAllocsByDate = new Map(); // dateStr -> total hours used so far

  for (let i = 0; i < scheduledTasks.length; i++) {
    const st = scheduledTasks[i];
    const task = taskMap[st.taskId];
    const deadlineDate = new Date(task.deadline);
    deadlineDate.setHours(0, 0, 0, 0);

    const days = daysUntilDeadline(task.deadline);
    // Total capacity from today through deadline (inclusive of deadline day)
    const totalCapacity = (days + 1) * cap;

    // Hours already claimed by higher-priority tasks within [today..deadline]
    let hoursClaimedBefore = 0;
    for (const [dateStr, hrs] of cumulativeAllocsByDate) {
      const d = new Date(dateStr);
      d.setHours(0, 0, 0, 0);
      if (d <= deadlineDate) hoursClaimedBefore += hrs;
    }

    const hoursAvailable = totalCapacity - hoursClaimedBefore;
    if (task.estimatedHours > hoursAvailable) {
      st.isOverloaded = true;
    }

    // Now add this task's allocations to the cumulative map for subsequent tasks
    for (const alloc of st.allocations) {
      cumulativeAllocsByDate.set(
        alloc.dateStr,
        (cumulativeAllocsByDate.get(alloc.dateStr) || 0) + alloc.hours
      );
    }
  }

  // ── 5. Build dailySchedule view ──────────────────────────────────────────
  // Collect all date strings that have allocations
  const allDateStrs = new Set();
  for (const st of scheduledTasks) {
    for (const alloc of st.allocations) allDateStrs.add(alloc.dateStr);
  }

  // Build a lookup: taskId -> task
  // Build daily entries
  const dailyMap = new Map(); // dateStr -> {date, dateStr, label, entries[]}

  for (const st of scheduledTasks) {
    const task = taskMap[st.taskId];
    for (const alloc of st.allocations) {
      if (!dailyMap.has(alloc.dateStr)) {
        dailyMap.set(alloc.dateStr, {
          date: alloc.date,
          dateStr: alloc.dateStr,
          label: formatDayLabel(alloc.date),
          entries: [],
        });
      }
      dailyMap.get(alloc.dateStr).entries.push({
        taskId: task.id,
        taskName: task.name,
        hours: alloc.hours,
        isOverloaded: st.isOverloaded,
      });
    }
  }

  const dailySchedule = Array.from(dailyMap.values()).sort(
    (a, b) => a.date - b.date
  );

  return { scheduledTasks, dailySchedule };
}
