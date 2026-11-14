# FlowDesk — Task CRM

A Chrome extension (Manifest V3) that turns your task list into a small CRM: track contacts, stages, progress, and how consistently you finish work.

It ships two surfaces:

- **Popup** — quick capture and a compact task list for daily use.
- **Dashboard** — full kanban board, task editor, search, and consistency analytics.

No build step, no external services. All data stays on your machine.

## Install (load unpacked)

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select the `flowdesk` folder.
4. Pin **FlowDesk** to the toolbar.

Open the popup from the toolbar. Click **Open board** (or the grid icon in the popup header) to open the full dashboard in a tab.

> After editing files, press the reload icon on the FlowDesk card in `chrome://extensions`.

## Features

### Task CRM

Each task has:

| Field | Details |
| --- | --- |
| Title | What needs doing |
| Contact / company | Who it is for (the CRM part) |
| Priority | Low / Medium / High |
| Stage | Backlog / In progress / Done |
| Progress | 0–100%, adjustable in 25% steps on the board |
| Due date | Overdue and "Today" chips appear automatically |
| Repeat | Does not repeat / Daily / Weekly / Monthly |
| Notes | Context, next steps, links |

Tasks can be created, edited, completed, reopened, searched, and deleted.

### Popup

- Quick-add row: title, priority, contact, due date — and how often the task repeats.
- Active / done-today / day-streak counters.
- Filter chips: **All**, **Active**, **Done**.
- One-click complete or reopen, plus delete.
- Footer summary of overdue and in-progress work.

### Dashboard

- Three-column kanban: **Backlog**, **In progress**, **Done**.
- Drag and drop between columns (`Done → Backlog` resets progress to 0).
- `−` / `+` buttons to step progress by 25%.
- Search across title, contact, and notes.
- Create/edit dialog with a progress slider and a repeat option.
- **Clear completed** removes finished tasks without touching completion history.
- Four KPI cards: active pipeline, completed, 30-day consistency, current streak.
- 14-week completion heatmap with level colors and per-day tooltips.
- Side stats: streak, completions in the last 7 days, best day.

### Badge

The background service worker keeps the toolbar badge in sync with the number of open (not done) tasks.

## How progress and consistency work

- Setting a task to **Done** forces progress to 100% and adds one completion to today's history.
- Moving a done task back to **In progress** removes that completion from the original completion date and sets progress to 50%.
- Dragging a card into **Backlog** sets progress to 0 — backlog means not started.
- Reaching 100% by stepping progress marks the task done automatically.
- **Completion history is separate from tasks.** Deleting a task (or clearing completed ones) never erases the days you actually finished work, so streaks stay honest.
- **Current streak** counts consecutive days with at least one completion, ending today (or yesterday if nothing is done yet today).
- **Consistency · 30d** is the share of the last 30 days with at least one completion.
- The heatmap always shows the last 14 weeks, ending with the current week.

## Recurring tasks

Set **Repeat** on any task to `Daily`, `Weekly`, or `Monthly`. Recurrence is chain-based rather than a background scheduler, so it works even if the extension is closed for days.

- Completing a recurring task queues the **next instance** immediately. It is a new card in **Backlog** with 0% progress, the same title, contact, priority, notes, and repeat rule, and a due date one interval later.
- The due date advances from the original due date (or from today if none was set), skipping forward until it is in the future. If you finish three weeks of a weekly task late, you get one instance due next — not a backlog of missed copies.
- Cards that repeat show a small `Weekly` / `Monthly` chip so the chain is visible on the board and in the popup.
- **Reopening** a completed recurring task deletes the instance it spawned, so complete → reopen → complete does not duplicate the chain.
- **Monthly tasks clamp short months.** A task due Jan 31 next falls on Feb 28 (or 29 in a leap year). Following the chain from there keeps the 28th, because each step is computed from the previous due date.
- Repeating tasks never spawn on creation — only on the transition into **Done**.
- **Completion history counts only the instance you completed.** The spawned copy is a fresh task; finishing it later adds its own completion.

## Data and privacy

- Stored with `chrome.storage.local` under the key `flowdesk:state:v1`.
- Nothing is sent anywhere; the extension requests only the `storage` permission.
- To wipe everything: open the dashboard tab's DevTools console and run:

  ```js
  chrome.storage.local.clear();
  ```

  (When previewing the HTML files directly in a browser, use
  `localStorage.removeItem('flowdesk:state:v1')` instead.)

## Preview without installing

You can open `popup.html` or `dashboard.html` directly in Chrome. They detect the missing extension APIs and fall back to `localStorage`, so the UI is fully usable for a quick look. Two caveats in preview mode:

- Each page re-reads state after its own actions, but two open tabs will not live-sync.
- `Open board` uses `window.open`, which browsers may block without a real click.

## Project structure

```
flowdesk/
├── manifest.json          MV3 config, popup, service worker, icons
├── background.js          toolbar badge sync
├── popup.html / .css / .js
├── dashboard.html / .css / .js
├── lib/
│   ├── store.js           state, CRUD, recurrence, storage fallback, stats/streak/heatmap
│   └── theme.css          shared light-theme tokens and base components
└── icons/                 16 / 32 / 48 / 128 px PNGs
```

`lib/store.js` is the single source of truth for data logic, so the popup and dashboard always agree on behavior.
