import { today, addDays, toDateStr } from './scheduler.js';

/**
 * Generate seed tasks with deadlines relative to today,
 * so the demo always works regardless of when it's run.
 */
export function getSeedTasks() {
  const t = today();

  return [
    {
      id: 'seed-1',
      name: 'Math Review',
      deadline: toDateStr(addDays(t, 3)),
      weight: 4,
      estimatedHours: 5,
      dependsOn: null,
      completed: false,
    },
    {
      id: 'seed-2',
      name: 'CS Project',
      deadline: toDateStr(addDays(t, 5)),
      weight: 5,
      estimatedHours: 8,
      dependsOn: null,
      completed: false,
    },
    {
      id: 'seed-3',
      name: 'History Essay',
      deadline: toDateStr(addDays(t, 7)),
      weight: 3,
      estimatedHours: 4,
      dependsOn: null,
      completed: false,
    },
    {
      id: 'seed-4',
      name: 'Physics Lab Report',
      deadline: toDateStr(addDays(t, 6)),
      weight: 4,
      estimatedHours: 3,
      dependsOn: 'seed-2',   // blocked until CS Project is done
      completed: false,
    },
    {
      id: 'seed-5',
      name: 'Biology Quiz Prep',
      deadline: toDateStr(addDays(t, 10)),
      weight: 2,
      estimatedHours: 2,
      dependsOn: null,
      completed: false,
    },
  ];
}
