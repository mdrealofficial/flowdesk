/**
 * FlowDesk data layer.
 *
 * Uses chrome.storage.local inside the extension and falls back to
 * localStorage so the pages can be previewed in a plain browser tab.
 */

export const STORAGE_KEY = 'flowdesk:state:v1';
export const STATUSES = ['backlog', 'working', 'done'];
export const PRIORITIES = ['low', 'medium', 'high'];
export const REPEATS = ['none', 'daily', 'weekly', 'monthly'];

export const STATUS_LABEL = {
  backlog: 'Backlog',
  working: 'In progress',
  done: 'Done',
};

export const PRIORITY_LABEL = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

export const REPEAT_LABEL = {
  none: 'Does not repeat',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

export const inExtension = () =>
  typeof chrome !== 'undefined' && !!chrome.storage && !!chrome.storage.local;

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

function normalize(raw) {
  const base = { tasks: [], history: {}, createdAt: Date.now() };
  if (!raw || typeof raw !== 'object') return base;

  const tasks = Array.isArray(raw.tasks)
    ? raw.tasks
        .filter((t) => t && t.id && typeof t.title === 'string' && t.title.trim())
        .map((t) => ({
          id: String(t.id),
          title: String(t.title).slice(0, 160),
          contact: t.contact ? String(t.contact).slice(0, 120) : '',
          priority: PRIORITIES.includes(t.priority) ? t.priority : 'medium',
          status: STATUSES.includes(t.status) ? t.status : 'backlog',
          progress: clamp(Math.round(Number(t.progress) || 0), 0, 100),
          due: typeof t.due === 'string' ? t.due : '',
          notes: typeof t.notes === 'string' ? t.notes.slice(0, 2000) : '',
          repeat: REPEATS.includes(t.repeat) ? t.repeat : 'none',
          spawnedFrom: t.spawnedFrom ? String(t.spawnedFrom) : '',
          createdAt: Number(t.createdAt) || Date.now(),
          completedAt: Number(t.completedAt) || 0,
          updatedAt: Number(t.updatedAt) || Date.now(),
        }))
    : [];

  const history = {};
  if (raw.history && typeof raw.history === 'object') {
    for (const [key, value] of Object.entries(raw.history)) {
      const count = Math.max(0, Math.round(Number(value) || 0));
      if (count > 0) history[key] = count;
    }
  }

  return { tasks, history, createdAt: Number(raw.createdAt) || Date.now() };
}

/* ------------------------------------------------------------------ */
/* Storage                                                             */
/* ------------------------------------------------------------------ */

export async function getState() {
  if (inExtension()) {
    const res = await chrome.storage.local.get(STORAGE_KEY);
    return normalize(res[STORAGE_KEY]);
  }
  try {
    return normalize(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'));
  } catch {
    return normalize(null);
  }
}

export async function setState(state) {
  const next = normalize(state);
  if (inExtension()) {
    await chrome.storage.local.set({ [STORAGE_KEY]: next });
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

export async function mutate(fn) {
  const state = await getState();
  fn(state);
  return setState(state);
}

/** Listen for changes from other contexts (popup <-> dashboard). */
export function subscribe(callback) {
  if (inExtension()) {
    const listener = (changes, area) => {
      if (area === 'local' && changes[STORAGE_KEY]) {
        callback(normalize(changes[STORAGE_KEY].newValue));
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }

  const listener = (event) => {
    if (event.key !== STORAGE_KEY) return;
    try {
      callback(normalize(JSON.parse(event.newValue || 'null')));
    } catch {
      callback(normalize(null));
    }
  };
  window.addEventListener('storage', listener);
  return () => window.removeEventListener('storage', listener);
}

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

const pad = (n) => String(n).padStart(2, '0');

export function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function shiftDateKey(key, delta) {
  const date = parseKey(key);
  date.setDate(date.getDate() + delta);
  return dateKey(date);
}

/** Add whole months, clamping the day to the target month (Jan 31 -> Feb 28). */
function shiftMonthKey(key, delta = 1) {
  const date = parseKey(key);
  const day = date.getDate();
  const target = new Date(date.getFullYear(), date.getMonth() + delta, 1);
  const daysInMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, daysInMonth));
  return dateKey(target);
}

/**
 * Next due date for a recurring task.
 * Starts from the task's due date (or today when empty), advances one interval,
 * then keeps advancing until the result is in the future.
 */
export function nextDue(due, repeat, from = dateKey()) {
  if (!REPEATS.includes(repeat) || repeat === 'none') return '';
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(due || '');
  let key = valid ? due : from;

  const advance = () => {
    if (repeat === 'monthly') key = shiftMonthKey(key, 1);
    else key = shiftDateKey(key, repeat === 'weekly' ? 7 : 1);
  };

  advance();
  let guard = 0;
  while (key <= from && guard < 400) {
    advance();
    guard += 1;
  }
  return key;
}

/* ------------------------------------------------------------------ */
/* Task operations                                                     */
/* ------------------------------------------------------------------ */

export function uid() {
  return 't_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function bumpHistory(state, key, delta) {
  const next = Math.max(0, (state.history[key] || 0) + delta);
  if (next === 0) delete state.history[key];
  else state.history[key] = next;
}

export async function addTask(input) {
  const title = String(input.title || '').trim();
  if (!title) throw new Error('Task title is required.');

  const now = Date.now();
  const task = {
    id: uid(),
    title,
    contact: String(input.contact || '').trim(),
    priority: PRIORITIES.includes(input.priority) ? input.priority : 'medium',
    status: STATUSES.includes(input.status) ? input.status : 'backlog',
    progress: 0,
    due: typeof input.due === 'string' ? input.due : '',
    notes: String(input.notes || '').trim(),
    repeat: REPEATS.includes(input.repeat) ? input.repeat : 'none',
    spawnedFrom: '',
    createdAt: now,
    completedAt: 0,
    updatedAt: now,
  };

  if (task.status === 'done') {
    task.progress = 100;
    task.completedAt = now;
  }

  await mutate((state) => {
    state.tasks.unshift(task);
    if (task.status === 'done') bumpHistory(state, dateKey(), 1);
  });

  return task;
}

const PATCH_FIELDS = [
  'title',
  'contact',
  'priority',
  'status',
  'progress',
  'due',
  'notes',
  'repeat',
];

export async function updateTask(id, patch) {
  return mutate((state) => {
    const index = state.tasks.findIndex((t) => t.id === id);
    if (index === -1) return;
    const task = state.tasks[index];
    const prev = { ...task };

    for (const field of PATCH_FIELDS) {
      if (!(field in patch)) continue;
      if (field === 'progress') {
        task.progress = clamp(Math.round(Number(patch.progress) || 0), 0, 100);
      } else if (field === 'status') {
        if (STATUSES.includes(patch.status)) task.status = patch.status;
      } else if (field === 'priority') {
        if (PRIORITIES.includes(patch.priority)) task.priority = patch.priority;
      } else if (field === 'title') {
        const title = String(patch.title || '').trim();
        if (title) task.title = title.slice(0, 160);
      } else if (field === 'contact') {
        task.contact = String(patch.contact || '').trim().slice(0, 120);
      } else if (field === 'due') {
        task.due = typeof patch.due === 'string' ? patch.due : '';
      } else if (field === 'notes') {
        task.notes = String(patch.notes || '').slice(0, 2000);
      } else if (field === 'repeat') {
        if (REPEATS.includes(patch.repeat)) task.repeat = patch.repeat;
      }
    }

    // Keep status <-> progress coherent.
    if (patch.status === 'done') {
      task.progress = 100;
    } else if (patch.progress !== undefined && patch.status === undefined) {
      if (task.progress >= 100) {
        task.status = 'done';
      } else if (prev.status === 'done') {
        task.status = 'working';
      } else if (task.progress > 0 && task.status === 'backlog') {
        task.status = 'working';
      }
    } else if (patch.status === 'backlog' || patch.status === 'working') {
      if (patch.progress === undefined && prev.status === 'done') task.progress = 50;
      if (task.progress >= 100) task.progress = 75;
    }

    // Completion history.
    const becameDone = task.status === 'done' && prev.status !== 'done';
    const leftDone = task.status !== 'done' && prev.status === 'done';

    if (becameDone) {
      task.progress = 100;
      task.completedAt = Date.now();
      bumpHistory(state, dateKey(), 1);
    } else if (leftDone) {
      task.completedAt = 0;
      if (prev.completedAt) {
        bumpHistory(state, dateKey(new Date(prev.completedAt)), -1);
      }
    }

    if (task.status !== 'done' && task.progress >= 100) task.progress = 99;
    task.updatedAt = Date.now();
    state.tasks[index] = task;

    // Recurring tasks: spawn the next instance on completion, and undo the
    // spawn if the task is reopened so the chain does not duplicate.
    if (becameDone && task.repeat !== 'none') spawnNext(state, task);
    if (leftDone) {
      state.tasks = state.tasks.filter((t) => t.spawnedFrom !== task.id);
    }
  });
}

/** Queue the next occurrence of a completed recurring task. */
function spawnNext(state, task) {
  const exists = state.tasks.some(
    (t) => t.spawnedFrom === task.id && t.status !== 'done'
  );
  if (exists) return;

  const now = Date.now();
  state.tasks.unshift({
    id: uid(),
    title: task.title,
    contact: task.contact,
    priority: task.priority,
    status: 'backlog',
    progress: 0,
    due: nextDue(task.due, task.repeat),
    notes: task.notes,
    repeat: task.repeat,
    spawnedFrom: task.id,
    createdAt: now,
    completedAt: 0,
    updatedAt: now,
  });
}

export async function deleteTask(id) {
  return mutate((state) => {
    state.tasks = state.tasks.filter((task) => task.id !== id);
  });
}

export async function clearCompleted() {
  return mutate((state) => {
    state.tasks = state.tasks.filter((task) => task.status !== 'done');
  });
}

/* ------------------------------------------------------------------ */
/* Derived data                                                        */
/* ------------------------------------------------------------------ */

/** Consecutive days with at least one completion, ending today (or yesterday). */
export function computeStreak(history) {
  let cursor = new Date();
  if (!history[dateKey(cursor)]) {
    cursor.setDate(cursor.getDate() - 1);
    if (!history[dateKey(cursor)]) return 0;
  }
  let streak = 0;
  while (history[dateKey(cursor)] > 0) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function levelFor(count) {
  if (!count) return 0;
  if (count >= 5) return 4;
  if (count >= 3) return 3;
  if (count >= 2) return 2;
  return 1;
}

/** Oldest -> newest series of { date, label, count, level }. */
export function seriesFor(history, days, endKey = dateKey()) {
  const out = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const key = shiftDateKey(endKey, -i);
    const count = history[key] || 0;
    out.push({ date: key, count, level: levelFor(count) });
  }
  return out;
}

export function computeStats(state) {
  const { tasks, history } = state;
  const today = dateKey();
  const open = tasks.filter((t) => t.status !== 'done');
  const working = tasks.filter((t) => t.status === 'working');
  const overdue = open.filter((t) => t.due && t.due < today);
  const doneToday = history[today] || 0;
  const lifetime = Object.values(history).reduce((sum, n) => sum + n, 0);
  const last30 = seriesFor(history, 30);
  const activeDays30 = last30.filter((d) => d.count > 0).length;
  const week = seriesFor(history, 7);
  const weekTotal = week.reduce((sum, d) => sum + d.count, 0);

  return {
    total: tasks.length,
    open: open.length,
    working: working.length,
    overdue: overdue.length,
    doneToday,
    lifetime,
    streak: computeStreak(history),
    consistency30: Math.round((activeDays30 / 30) * 100),
    activeDays30,
    weekTotal,
    week,
  };
}

/* ------------------------------------------------------------------ */
/* Small UI helpers shared by popup and dashboard                      */
/* ------------------------------------------------------------------ */

export function formatDue(due) {
  if (!due) return null;
  const today = dateKey();
  if (due === today) return { text: 'Today', tone: 'warn' };
  if (due < today) return { text: 'Overdue', tone: 'bad' };
  if (due === shiftDateKey(today, 1)) return { text: 'Tomorrow', tone: 'warn' };
  const label = parseKey(due).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
  return { text: label, tone: 'muted' };
}

export function sortTasks(tasks) {
  const priorityRank = { high: 0, medium: 1, low: 2 };
  const statusRank = { working: 0, backlog: 1, done: 2 };
  return [...tasks].sort((a, b) => {
    if (statusRank[a.status] !== statusRank[b.status]) {
      return statusRank[a.status] - statusRank[b.status];
    }
    if (a.due && b.due && a.due !== b.due) return a.due < b.due ? -1 : 1;
    if (a.due && !b.due) return -1;
    if (!a.due && b.due) return 1;
    if (priorityRank[a.priority] !== priorityRank[b.priority]) {
      return priorityRank[a.priority] - priorityRank[b.priority];
    }
    return b.createdAt - a.createdAt;
  });
}

export function openBoard() {
  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  } else {
    window.open('dashboard.html', '_blank');
  }
}
