# Chrome Web Store Submission Guide for FlowDesk

This document contains everything you need to copy and paste directly into the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) when submitting **FlowDesk — Task CRM**.

---

## 1. Store Listing Information

### Extension Title
```
FlowDesk — Task CRM
```

### Short Description (Max 132 chars)
```
A lightweight task CRM: capture tasks, move them through your pipeline, and keep your daily streak alive.
```

### Detailed Description
```markdown
FlowDesk is a clean, local-first Task CRM and consistency tracker designed to help you manage contacts, task pipelines, and daily productivity streaks right from your browser.

With zero complicated setup, no external servers, and complete privacy, FlowDesk keeps you focused on getting things done.

✨ KEY FEATURES

• Fast Task Capture: Quickly add tasks with title, contact/company, priority, due date, and recurrence from the toolbar popup.
• Kanban Pipeline Board: Organize your workflow across Backlog, In Progress, and Done stages with drag-and-drop ease.
• Consistency Heatmap: Track your daily completions over 52 weeks with an intuitive GitHub-style activity grid.
• Recurring Tasks: Schedule daily, weekly, or monthly repeating tasks that automatically queue up when completed.
• Full Privacy & Local-First: All your tasks, notes, and metrics remain 100% on your machine using Chrome's secure local storage.
• Backup & Portability: Easily export your full workspace to a JSON backup and restore anytime.

🔒 PRIVACY & SECURITY
FlowDesk requests only the `storage` permission to save your tasks locally. It makes zero network calls and does not track or collect any personal information.
```

### Category
```
Productivity
```

### Language
```
English
```

---

## 2. Privacy Practices Tab

### Single Purpose
```
FlowDesk provides a lightweight task CRM and daily streak consistency tracker to organize personal and client tasks across pipeline stages.
```

### Permission Justification for `storage`
```
Required to persist user tasks, pipeline stages, recurrence rules, and streak completion history locally on the user's machine.
```

### Host Permissions Justification
*(None requested)*

### Data Usage Declarations
Answer **No** to all questions asking whether you collect:
- Personally identifiable information: **No**
- Financial and payment information: **No**
- Authentication information: **No**
- Web browsing history: **No**
- User activity / analytics: **No**

---

## 3. Privacy Policy Link

Paste this public URL into the **Privacy Policy URL** field:
```
https://github.com/mdrealofficial/flowdesk/blob/main/PRIVACY.md
```

---

## 4. Graphic Assets Checklist

1. **Extension Icon (128x128 PNG):**
   - File ready in: `icons/icon128.png`

2. **Screenshots (1280x800 or 640x400 PNG):**
   - At least 1 is required; 3 recommended:
     1. Full Kanban Dashboard (`dashboard.html`).
     2. 52-Week Consistency Tracker (`dashboard.html` bottom).
     3. Toolbar Quick-Add Popup (`popup.html`).

3. **ZIP Package to Upload:**
   - Run: `zip -r flowdesk.zip manifest.json background.js popup.html popup.js popup.css dashboard.html dashboard.js dashboard.css icons/ lib/`
