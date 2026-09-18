import { useEffect, useRef, useState } from 'react';

/**
 * DailySchedule — primary output view grouped by day.
 *
 * Props:
 *   dailySchedule  : DayEntry[]   — from runScheduler
 *   prevScheduleRef: ref to previous schedule (for highlighting changes)
 */
export default function DailySchedule({ dailySchedule, highlightedTaskIds }) {
  if (dailySchedule.length === 0) {
    return (
      <div className="daily-schedule">
        <h2 className="section-title">📅 Daily Schedule</h2>
        <p className="empty-msg">
          No tasks scheduled. Add tasks and set a daily hours cap to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="daily-schedule">
      <h2 className="section-title">📅 Daily Schedule</h2>
      <div className="day-list">
        {dailySchedule.map((day) => (
          <DayCard key={day.dateStr} day={day} highlightedTaskIds={highlightedTaskIds} />
        ))}
      </div>
    </div>
  );
}

function DayCard({ day, highlightedTaskIds }) {
  const totalHours = day.entries.reduce((s, e) => s + e.hours, 0);
  const isToday = day.label.startsWith('Today');
  const isTomorrow = day.label.startsWith('Tomorrow');

  return (
    <div className={`day-card ${isToday ? 'day-today' : ''} ${isTomorrow ? 'day-tomorrow' : ''}`}>
      <div className="day-header">
        <span className="day-label">{day.label}</span>
        <span className="day-total">{formatHours(totalHours)} total</span>
      </div>
      <ul className="day-entries">
        {day.entries.map((entry, idx) => (
          <EntryRow
            key={`${entry.taskId}-${idx}`}
            entry={entry}
            highlighted={highlightedTaskIds?.has(entry.taskId)}
          />
        ))}
      </ul>
    </div>
  );
}

function EntryRow({ entry, highlighted }) {
  const [flash, setFlash] = useState(false);
  const prevHighlighted = useRef(false);

  useEffect(() => {
    // Only flash when `highlighted` transitions false → true
    if (highlighted && !prevHighlighted.current) {
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), 1200);
      prevHighlighted.current = true;
      return () => clearTimeout(timer);
    }
    if (!highlighted) {
      prevHighlighted.current = false;
    }
  }, [highlighted]);

  return (
    <li className={`entry-row ${flash ? 'entry-flash' : ''} ${entry.isOverloaded ? 'entry-overloaded' : ''}`}>
      <span className="entry-hours">{formatHours(entry.hours)}</span>
      <span className="entry-name">{entry.taskName}</span>
      {entry.isOverloaded && (
        <span className="entry-overload-badge" title="Not enough time before deadline">⚠️</span>
      )}
    </li>
  );
}

function formatHours(h) {
  if (h === 1) return '1 hr';
  // Show clean decimals: 2.5 → "2.5 hrs", 3 → "3 hrs"
  const str = Number.isInteger(h) ? String(h) : h.toFixed(1);
  return `${str} hrs`;
}
