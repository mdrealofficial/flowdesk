import {
  getState,
  setState,
  subscribe,
  addTask,
  updateTask,
  deleteTask,
  clearCompleted,
  computeStats,
  sortTasks,
  formatDue,
  levelFor,
  dateKey,
  appConfirm,
  appAlert,
  PRIORITY_LABEL,
  REPEAT_LABEL,
} from './lib/store.js';

const $ = (selector) => document.querySelector(selector);

const els = {
  kpiOpen: $('#kpi-open'),
  kpiOpenFoot: $('#kpi-open-foot'),
  kpiDone: $('#kpi-done'),
  kpiDoneFoot: $('#kpi-done-foot'),
  kpiConsistency: $('#kpi-consistency'),
  kpiConsistencyFoot: $('#kpi-consistency-foot'),
  kpiStreak: $('#kpi-streak'),
  kpiStreakFoot: $('#kpi-streak-foot'),
  board: $('#board'),
  heatmap: $('#heatmap'),
  heatmapMonths: $('#heatmap-months'),
  heatRange: $('#heat-range'),
  sideStreak: $('#side-streak'),
  sideStreakLabel: $('#side-streak-label'),
  sideWeek: $('#side-week'),
  sideBest: $('#side-best'),
  search: $('#search'),
  exportBtn: $('#export-btn'),
  importInput: $('#import-input'),
  newTask: $('#new-task'),
  clearDone: $('#clear-done'),
  dialog: $('#task-dialog'),
  form: $('#task-form'),
  dialogTitle: $('#dialog-title'),
  dialogClose: $('#dialog-close'),
  dialogCancel: $('#dialog-cancel'),
  deleteBtn: $('#delete-task'),
  fTitle: $('#f-title'),
  fContact: $('#f-contact'),
  fDue: $('#f-due'),
  fPriority: $('#f-priority'),
  fStatus: $('#f-status'),
  fRepeat: $('#f-repeat'),
  fProgress: $('#f-progress'),
  fProgressOut: $('#f-progress-out'),
  fNotes: $('#f-notes'),
};

const COLUMNS = [
  { status: 'backlog', title: 'Backlog' },
  { status: 'working', title: 'In progress' },
  { status: 'done', title: 'Done' },
];

const ICON = {
  person:
    '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 19c.8-3.3 3.3-5 6.5-5s5.7 1.7 6.5 5" stroke-linecap="round"/></svg>',
  edit:
    '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4l10-10-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></svg>',
  trash:
    '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4.8h6V7M6.5 7l.8 12.2h9.4L17.5 7"/></svg>',
  repeat:
    '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2.5 20.5 6 17 9.5"/><path d="M3.5 11.5V10a4 4 0 0 1 4-4h13"/><path d="M7 21.5 3.5 18 7 14.5"/><path d="M20.5 12.5V14a4 4 0 0 1-4 4h-13"/></svg>',
};

let state = null;
let query = '';
let editingId = null;

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
  els.newTask.addEventListener('click', () => openDialog());
  els.clearDone.addEventListener('click', onClearDone);
  els.search.addEventListener('input', () => {
    query = els.search.value.trim().toLowerCase();
    renderBoard();
  });

  if (els.exportBtn) {
    els.exportBtn.addEventListener('click', onExport);
  }

  if (els.importInput) {
    els.importInput.addEventListener('change', onImport);
  }

  els.dialogClose.addEventListener('click', () => els.dialog.close());
  els.dialogCancel.addEventListener('click', () => els.dialog.close());
  els.dialog.addEventListener('click', (event) => {
    if (event.target === els.dialog) els.dialog.close();
  });

  els.form.addEventListener('submit', onSaveTask);
  els.deleteBtn.addEventListener('click', onDeleteFromDialog);

  els.fProgress.addEventListener('input', updateProgressOutput);
}

function onExport() {
  if (!state) return;
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state, null, 2));
  const a = document.createElement('a');
  a.setAttribute('href', dataStr);
  a.setAttribute('download', `flowdesk-backup-${dateKey()}.json`);
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function onImport(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data || (!Array.isArray(data.tasks) && typeof data.history !== 'object')) {
      throw new Error('Invalid FlowDesk backup file format.');
    }
    const confirmed = await appConfirm({
      title: 'Import Workspace',
      message: `Import ${data.tasks ? data.tasks.length : 0} tasks and history into FlowDesk? This will replace your current workspace.`,
      confirmText: 'Import & Replace',
      cancelText: 'Cancel',
      danger: true,
    });
    if (!confirmed) return;

    await setState(data);
    await reload();
    await appAlert('FlowDesk workspace successfully imported!', 'Import Successful');
  } catch (err) {
    await appAlert('Failed to import file: ' + err.message, 'Import Error');
  } finally {
    event.target.value = '';
  }
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

function render() {
  if (!state) return;
  const stats = computeStats(state);

  els.kpiOpen.textContent = String(stats.open);
  els.kpiOpenFoot.textContent = `${stats.working} in progress · ${stats.overdue} overdue`;
  els.kpiDone.textContent = String(stats.lifetime);
  els.kpiDoneFoot.textContent = `${stats.doneToday} today`;
  els.kpiConsistency.textContent = `${stats.consistency30}%`;
  els.kpiConsistencyFoot.textContent = `${stats.activeDays30} of 30 active days`;
  els.kpiStreak.textContent = String(stats.streak);
  els.kpiStreakFoot.textContent = stats.streak === 1 ? 'day in a row' : 'days in a row';

  els.sideStreak.textContent = String(stats.streak);
  els.sideStreakLabel.textContent = stats.streak === 1 ? 'day in streak' : 'days in streak';
  els.sideWeek.textContent = String(stats.weekTotal);
  els.sideBest.textContent = String(bestDay(state.history));

  renderBoard();
  renderHeatmap();
}

function bestDay(history) {
  let best = 0;
  for (const count of Object.values(history)) {
    if (count > best) best = count;
  }
  return best;
}

function renderBoard() {
  if (!state) return;

  const visible = query
    ? state.tasks.filter((task) =>
        `${task.title} ${task.contact} ${task.notes}`.toLowerCase().includes(query)
      )
    : state.tasks;

  els.board.replaceChildren();

  for (const { status, title } of COLUMNS) {
    const column = document.createElement('div');
    column.className = `column col-${status}`;

    const head = document.createElement('div');
    head.className = 'column-head';

    const dot = document.createElement('span');
    dot.className = 'column-dot';

    const heading = document.createElement('span');
    heading.className = 'column-title';
    heading.textContent = title;

    const items = sortTasks(visible.filter((task) => task.status === status));

    const count = document.createElement('span');
    count.className = 'column-count';
    count.textContent = String(items.length);

    head.append(dot, heading, count);

    const cards = document.createElement('div');
    cards.className = 'column-cards';

    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'column-empty';
      empty.textContent = query ? 'No matches' : status === 'done' ? 'Nothing completed yet' : 'Drop tasks here';
      cards.append(empty);
    } else {
      for (const task of items) cards.append(taskCard(task));
    }

    column.append(head, cards);
    attachDrop(column, status);
    els.board.append(column);
  }
}

function attachDrop(column, status) {
  column.addEventListener('dragover', (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    column.classList.add('drag-over');
  });

  column.addEventListener('dragleave', (event) => {
    if (!column.contains(event.relatedTarget)) column.classList.remove('drag-over');
  });

  column.addEventListener('drop', async (event) => {
    event.preventDefault();
    column.classList.remove('drag-over');
    const id = event.dataTransfer.getData('text/plain');
    if (!id) return;
    const task = state.tasks.find((t) => t.id === id);
    if (!task || task.status === status) return;
    await updateTask(id, status === 'backlog' ? { status, progress: 0 } : { status });
    await reload();
  });
}

function taskCard(task) {
  const done = task.status === 'done';
  const progress = done ? 100 : task.progress;

  const card = document.createElement('article');
  card.className = 'task-card' + (done ? ' is-done' : '');
  card.draggable = true;

  card.addEventListener('dragstart', (event) => {
    event.dataTransfer.setData('text/plain', task.id);
    event.dataTransfer.effectAllowed = 'move';
    card.classList.add('dragging');
  });
  card.addEventListener('dragend', () => card.classList.remove('dragging'));

  /* Top row */
  const top = document.createElement('div');
  top.className = 'card-top';

  const pill = document.createElement('span');
  pill.className = `pill pill-priority-${task.priority}`;
  pill.textContent = PRIORITY_LABEL[task.priority];

  const actions = document.createElement('div');
  actions.className = 'card-actions';

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'card-action';
  editBtn.title = 'Edit task';
  editBtn.setAttribute('aria-label', 'Edit task');
  editBtn.innerHTML = ICON.edit;
  editBtn.addEventListener('click', () => openDialog(task));

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'card-action danger';
  deleteBtn.title = 'Delete task';
  deleteBtn.setAttribute('aria-label', 'Delete task');
  deleteBtn.innerHTML = ICON.trash;
  deleteBtn.addEventListener('click', () => removeTask(task));

  actions.append(editBtn, deleteBtn);
  top.append(pill, actions);

  /* Title */
  const title = document.createElement('h3');
  title.className = 'card-title';
  title.textContent = task.title;
  title.addEventListener('dblclick', () => openDialog(task));

  /* Contact */
  let contact = null;
  if (task.contact) {
    contact = document.createElement('div');
    contact.className = 'card-contact';
    contact.innerHTML = ICON.person;
    const label = document.createElement('span');
    label.textContent = task.contact;
    label.title = task.contact;
    contact.append(label);
  }

  /* Meta */
  const meta = document.createElement('div');
  meta.className = 'card-meta';
  const due = formatDue(task.due);
  if (due) {
    const chip = document.createElement('span');
    chip.className = 'pill pill-due ' + due.tone;
    chip.textContent = due.text;
    meta.append(chip);
  }

  const repeat = repeatChip(task.repeat);
  if (repeat) meta.append(repeat);

  /* Progress */
  const row = document.createElement('div');
  row.className = 'card-progress';

  const minus = document.createElement('button');
  minus.type = 'button';
  minus.className = 'step-btn';
  minus.textContent = '−';
  minus.title = 'Decrease progress';
  minus.setAttribute('aria-label', 'Decrease progress');
  minus.disabled = progress <= 0;
  minus.addEventListener('click', async () => {
    await updateTask(task.id, { progress: Math.max(0, progress - 25) });
    await reload();
  });

  const track = document.createElement('div');
  track.className = 'progress-track';
  const fill = document.createElement('div');
  fill.className = 'progress-fill';
  fill.style.width = progress + '%';
  track.append(fill);

  const pct = document.createElement('span');
  pct.className = 'card-pct';
  pct.textContent = progress + '%';

  const plus = document.createElement('button');
  plus.type = 'button';
  plus.className = 'step-btn';
  plus.textContent = '+';
  plus.title = 'Increase progress';
  plus.setAttribute('aria-label', 'Increase progress');
  plus.disabled = progress >= 100;
  plus.addEventListener('click', async () => {
    await updateTask(task.id, { progress: Math.min(100, progress + 25) });
    await reload();
  });

  row.append(minus, track, pct, plus);

  card.append(top, title);
  if (contact) card.append(contact);
  if (meta.childElementCount) card.append(meta);
  card.append(row);

  return card;
}

function repeatChip(repeat) {
  if (!repeat || repeat === 'none') return null;
  const chip = document.createElement('span');
  chip.className = 'pill pill-repeat';
  chip.title = 'Repeats ' + repeat;
  chip.innerHTML = ICON.repeat;
  const label = document.createElement('span');
  label.textContent = REPEAT_LABEL[repeat];
  chip.append(label);
  return chip;
}

function renderHeatmap() {
  if (!state) return;

  const history = state.history;
  const today = new Date();
  const todayStr = dateKey(today);

  const numWeeks = 52;
  const start = new Date(today);
  start.setDate(start.getDate() - (today.getDay() + (numWeeks - 1) * 7));
  start.setHours(0, 0, 0, 0);

  const cells = [];
  const monthLabels = [];
  let lastMonth = -1;

  for (let w = 0; w < numWeeks; w += 1) {
    const weekStart = new Date(start);
    weekStart.setDate(start.getDate() + w * 7);
    const m = weekStart.getMonth();

    if (m !== lastMonth) {
      monthLabels.push({
        text: weekStart.toLocaleDateString(undefined, { month: 'short' }),
        pct: (w / numWeeks) * 100,
      });
      lastMonth = m;
    }
  }

  for (let i = 0; i < numWeeks * 7; i += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);

    const key = dateKey(day);
    const future = key > todayStr;
    const count = future ? 0 : history[key] || 0;

    const cell = document.createElement('div');
    cell.className = 'heat-cell' + (future ? ' future' : ` lvl-${levelFor(count)}`);
    if (!future) {
      const dateLabel = day.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      cell.title = `${dateLabel} — ${count} task${count === 1 ? '' : 's'} completed`;
    }
    cells.push(cell);
  }

  if (els.heatmapMonths) {
    els.heatmapMonths.replaceChildren();
    for (const item of monthLabels) {
      const span = document.createElement('span');
      span.textContent = item.text;
      span.style.position = 'absolute';
      span.style.left = `${item.pct}%`;
      els.heatmapMonths.append(span);
    }
  }

  els.heatmap.replaceChildren(...cells);

  const end = new Date(today);
  const fmt = (date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  els.heatRange.textContent = `${fmt(start)} – ${fmt(end)} · hover a cell for details`;
}

/* ------------------------------------------------------------------ */
/* Dialog                                                              */
/* ------------------------------------------------------------------ */

function openDialog(task = null) {
  editingId = task ? task.id : null;

  els.dialogTitle.textContent = task ? 'Edit task' : 'New task';
  els.deleteBtn.hidden = !task;

  els.fTitle.value = task ? task.title : '';
  els.fContact.value = task ? task.contact : '';
  els.fDue.value = task ? task.due : '';
  els.fPriority.value = task ? task.priority : 'medium';
  els.fStatus.value = task ? task.status : 'backlog';
  els.fRepeat.value = task ? task.repeat : 'none';
  els.fProgress.value = String(task ? task.progress : 0);
  els.fNotes.value = task ? task.notes : '';

  updateProgressOutput();

  els.dialog.showModal();
  requestAnimationFrame(() => els.fTitle.focus());
}

function updateProgressOutput() {
  const value = Number(els.fProgress.value) || 0;
  els.fProgressOut.value = `${value}%`;
  els.fProgressOut.textContent = `${value}%`;
  els.fProgress.style.setProperty('--fill', `${value}%`);
}

async function onSaveTask(event) {
  event.preventDefault();

  const title = els.fTitle.value.trim();
  if (!title) {
    els.fTitle.focus();
    return;
  }

  const data = {
    title,
    contact: els.fContact.value,
    due: els.fDue.value,
    priority: els.fPriority.value,
    status: els.fStatus.value,
    repeat: els.fRepeat.value,
    progress: Number(els.fProgress.value) || 0,
    notes: els.fNotes.value,
  };

  els.form.querySelector('[type="submit"]').disabled = true;
  try {
    if (editingId) {
      await updateTask(editingId, data);
    } else {
      await addTask(data);
    }
    els.dialog.close();
    await reload();
  } catch (error) {
    console.error('[FlowDesk] failed to save task', error);
  } finally {
    els.form.querySelector('[type="submit"]').disabled = false;
  }
}

async function onDeleteFromDialog() {
  if (!editingId) return;
  const task = state.tasks.find((t) => t.id === editingId);
  if (!task) return;
  const ok = await appConfirm({
    title: 'Delete Task',
    message: `Are you sure you want to delete “${task.title}”?`,
    confirmText: 'Delete',
    cancelText: 'Cancel',
    danger: true,
  });
  if (!ok) return;
  els.dialog.close();
  await deleteTask(editingId);
  await reload();
}

async function removeTask(task) {
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
}

async function onClearDone() {
  const done = state.tasks.filter((task) => task.status === 'done').length;
  if (done === 0) return;
  const ok = await appConfirm({
    title: 'Clear Completed',
    message: `Remove ${done} completed task${done === 1 ? '' : 's'}? History stays intact.`,
    confirmText: 'Clear',
    cancelText: 'Cancel',
    danger: true,
  });
  if (!ok) return;
  await clearCompleted();
  await reload();
}
