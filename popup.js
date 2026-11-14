import {
  getState,
  subscribe,
  addTask,
  updateTask,
  deleteTask,
  computeStats,
  sortTasks,
  formatDue,
  openBoard,
  appConfirm,
  dateKey,
  shiftDateKey,
  PRIORITY_LABEL,
  REPEAT_LABEL,
} from './lib/store.js';

const $ = (selector) => document.querySelector(selector);

const REPEAT_ICON =
  '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2.5 20.5 6 17 9.5"/><path d="M3.5 11.5V10a4 4 0 0 1 4-4h13"/><path d="M7 21.5 3.5 18 7 14.5"/><path d="M20.5 12.5V14a4 4 0 0 1-4 4h-13"/></svg>';

const els = {
  statActive: $('#stat-active'),
  statDone: $('#stat-done'),
  statStreak: $('#stat-streak'),
  form: $('#quick-add'),
  title: $('#task-title'),
  priority: $('#task-priority'),
  contact: $('#task-contact'),
  due: $('#task-due'),
  repeat: $('#task-repeat'),
  list: $('#task-list'),
  footerNote: $('#footer-note'),
  filters: $('#filters'),
  duePresets: $('#due-presets'),
  toggleQuickAdd: $('#toggle-quick-add'),
  openBoard: $('#open-board'),
  openBoard2: $('#open-board-2'),
};

let state = null;
let filter = 'all';

boot();

async function boot() {
  bindEvents();
  state = await getState();
  render();

  subscribe((next) => {
    state = next;
    render();
  });
}

async function reload() {
  state = await getState();
  render();
}

function bindEvents() {
  els.form.addEventListener('submit', onAddTask);

  if (els.duePresets) {
    els.duePresets.addEventListener('click', (event) => {
      const chip = event.target.closest('.preset-chip');
      if (!chip) return;
      const offset = Number(chip.dataset.offset) || 0;
      els.due.value = shiftDateKey(dateKey(), offset);
    });
  }

  if (els.toggleQuickAdd) {
    els.toggleQuickAdd.addEventListener('click', () => {
      const isCollapsed = els.form.classList.toggle('is-collapsed');
      els.toggleQuickAdd.classList.toggle('is-active', !isCollapsed);
      els.toggleQuickAdd.setAttribute('aria-expanded', String(!isCollapsed));
      if (!isCollapsed) {
        els.title.focus();
      }
    });
  }

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !els.form.classList.contains('is-collapsed')) {
      els.form.classList.add('is-collapsed');
      if (els.toggleQuickAdd) {
        els.toggleQuickAdd.classList.remove('is-active');
        els.toggleQuickAdd.setAttribute('aria-expanded', 'false');
      }
    }
  });

  els.filters.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-filter]');
    if (!chip) return;
    filter = chip.dataset.filter;
    for (const btn of els.filters.querySelectorAll('.chip')) {
      btn.classList.toggle('is-active', btn === chip);
    }
    renderList();
  });

  els.openBoard.addEventListener('click', openBoard);
  els.openBoard2.addEventListener('click', openBoard);
}

async function onAddTask(event) {
  event.preventDefault();
  const title = els.title.value.trim();
  if (!title) return;

  const submit = els.form.querySelector('[type="submit"]');
  submit.disabled = true;
  try {
    await addTask({
      title,
      priority: els.priority.value,
      contact: els.contact.value,
      due: els.due.value,
      repeat: els.repeat.value,
    });
    els.form.reset();
    els.priority.value = 'medium';
    els.repeat.value = 'none';
    els.form.classList.add('is-collapsed');
    if (els.toggleQuickAdd) {
      els.toggleQuickAdd.classList.remove('is-active');
      els.toggleQuickAdd.setAttribute('aria-expanded', 'false');
    }
    await reload();
  } catch (error) {
    console.error('[FlowDesk] failed to add task', error);
  } finally {
    submit.disabled = false;
  }
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

function render() {
  if (!state) return;
  const stats = computeStats(state);
  els.statActive.textContent = String(stats.open);
  els.statDone.textContent = String(stats.doneToday);
  els.statStreak.textContent = String(stats.streak);

  if (stats.overdue > 0) {
    els.footerNote.textContent = `${stats.overdue} overdue · ${stats.working} in progress`;
  } else if (stats.working > 0) {
    els.footerNote.textContent = `${stats.working} task${stats.working === 1 ? '' : 's'} in progress`;
  } else {
    els.footerNote.textContent = 'Everything is up to date';
  }

  renderList();
}

function renderList() {
  if (!state) return;

  const tasks = sortTasks(
    state.tasks.filter((task) => {
      if (filter === 'active') return task.status !== 'done';
      if (filter === 'done') return task.status === 'done';
      return true;
    })
  );

  els.list.replaceChildren();

  if (tasks.length === 0) {
    els.list.append(emptyState());
    return;
  }

  for (const task of tasks) {
    els.list.append(taskRow(task));
  }
}

function emptyState() {
  const wrap = document.createElement('li');
  wrap.className = 'empty';
  wrap.innerHTML = `
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.6">
      <path d="M9 11.5 11.5 14 15.5 9.5" stroke-linecap="round" stroke-linejoin="round" />
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
    </svg>`;

  const text = document.createElement('div');
  if (filter === 'done') {
    text.innerHTML = 'No completed tasks yet.<br /><strong>Finish one to get started.</strong>';
  } else if (filter === 'active') {
    text.innerHTML = 'Nothing in the pipeline.<br /><button type="button" class="link-btn empty-action">Add task +</button>';
  } else {
    text.innerHTML = 'Your board is empty.<br /><button type="button" class="link-btn empty-action">Capture your first task +</button>';
  }
  wrap.append(text);

  const action = wrap.querySelector('.empty-action');
  if (action) {
    action.addEventListener('click', () => {
      els.form.classList.remove('is-collapsed');
      if (els.toggleQuickAdd) {
        els.toggleQuickAdd.classList.add('is-active');
        els.toggleQuickAdd.setAttribute('aria-expanded', 'true');
      }
      els.title.focus();
    });
  }

  return wrap;
}

function taskRow(task) {
  const done = task.status === 'done';
  const progress = done ? 100 : task.progress;

  const li = document.createElement('li');
  li.className = 'task' + (done ? ' is-done' : '');

  const check = document.createElement('button');
  check.type = 'button';
  check.className = 'check';
  check.title = done ? 'Mark as not done' : 'Mark as done';
  check.setAttribute('aria-label', check.title);
  check.innerHTML =
    '<svg viewBox="0 0 24 24" width="12" height="12" fill="none"><path d="M20 6 9 17l-5-5" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  check.addEventListener('click', async () => {
    await updateTask(task.id, { status: done ? 'working' : 'done' });
    await reload();
  });

  const body = document.createElement('div');
  body.className = 'task-body';

  const title = document.createElement('span');
  title.className = 'task-title';
  title.textContent = task.title;
  title.title = task.title;

  const meta = document.createElement('div');
  meta.className = 'task-meta';

  const dot = document.createElement('span');
  dot.className = 'prio-dot prio-' + task.priority;
  dot.title = 'Priority: ' + PRIORITY_LABEL[task.priority];
  meta.append(dot);

  if (task.contact) {
    const contact = document.createElement('span');
    contact.className = 'task-contact';
    contact.textContent = task.contact;
    contact.title = task.contact;
    meta.append(contact);
  } else if (!task.due) {
    const stage = document.createElement('span');
    stage.textContent = done ? 'Completed' : task.status === 'working' ? 'In progress' : 'Backlog';
    meta.append(stage);
  }

  const due = formatDue(task.due);
  if (due) {
    const chip = document.createElement('span');
    chip.className = 'pill pill-due ' + due.tone;
    chip.textContent = due.text;
    meta.append(chip);
  }

  if (task.repeat && task.repeat !== 'none') {
    const chip = document.createElement('span');
    chip.className = 'pill pill-repeat';
    chip.title = 'Repeats ' + task.repeat;
    chip.innerHTML = REPEAT_ICON;
    const label = document.createElement('span');
    label.textContent = REPEAT_LABEL[task.repeat];
    chip.append(label);
    meta.append(chip);
  }

  body.append(title, meta);

  const progressRow = document.createElement('div');
  progressRow.className = 'progress';

  const track = document.createElement('div');
  track.className = 'progress-track';
  const fill = document.createElement('div');
  fill.className = 'progress-fill';
  fill.style.width = progress + '%';
  track.append(fill);

  const num = document.createElement('span');
  num.className = 'progress-num';
  num.textContent = progress + '%';

  progressRow.append(track, num);
  body.append(progressRow);

  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'task-delete';
  del.title = 'Delete task';
  del.setAttribute('aria-label', 'Delete task');
  del.innerHTML =
    '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  del.addEventListener('click', async () => {
    const ok = await appConfirm({
      title: 'Delete Task',
      message: `Are you sure you want to delete “${task.title}”?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      danger: true,
    });
    if (!ok) return;
    await deleteTask(task.id);
    await reload();
  });

  li.append(check, body, del);
  return li;
}
