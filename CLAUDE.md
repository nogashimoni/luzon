# Luzon — Project Onboarding for Claude

## What is Luzon?
A real-time collaborative project management app built for a small team (Amit + Kiper). It combines a project sidebar with a FullCalendar view, checklist tasks, financial tracking, notes, and an AI command bar.

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Database**: Supabase (PostgreSQL + realtime subscriptions)
- **Hosting**: Netlify (static site + serverless functions)
- **Calendar**: FullCalendar 6
- **AI**: Google Gemini 2.0 Flash via Netlify function (`GEMINI_API_KEY`)

## Repository & Deployment
- **Git repo**: Gitea at `http://127.0.0.1` — branch protection on `main`, always develop on a `claude/` branch and open a PR
- **Deployed on Netlify**: auto-deploys from `main` on merge
- **Branch naming**: `claude/<description>-<sessionId>` (push will 403 if not following this pattern)

## Environment Variables
**Local `.env`** (never committed):
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_PASSWORD=your-app-password
```

**Netlify dashboard** (Settings → Environment variables):
```
GEMINI_API_KEY=...   # Google Gemini API key (from aistudio.google.com, must be from AI Studio not GCloud Console)
```

## Supabase Database
Project: `nogashimoni` on Supabase free plan.

### Tables
| Table | Purpose |
|-------|---------|
| `users` | App users (Amit + Kiper), includes `avatar_url` |
| `projects` | Projects with color, status, type, deadline, sort_order |
| `project_notes` | One note per project, auto-saved |
| `project_checklist_items` | Tasks per project with drag-reorder (`item_order`) |
| `project_financials` | Monthly income/expenses per project (YYYY-MM format) |
| `calendar_events` | Calendar events with `exclude_from_hours` flag |
| `event_assignees` | Junction table — many users per event |

### Migrations
Run new migrations manually in Supabase SQL Editor (free plan has no CLI migration runner):
- `supabase/migrations/001_initial_schema.sql` — core tables
- `supabase/migrations/002_*` — project status + multi-user event assignments
- `supabase/migrations/003_add_project_checklist.sql`
- `supabase/migrations/004_add_project_financials.sql`
- `supabase/migrations/005_add_exclude_from_hours.sql`
- `supabase/migrations/006_add_project_deadline_and_order.sql`
- `supabase/migrations/007_add_project_type.sql`

All migrations use `IF NOT EXISTS` — safe to re-run.

## Authentication
Hardcoded in `src/contexts/UserContext.tsx` — only "Amit" and "Kiper" can log in. User ID stored in `localStorage`. There's also a `VITE_APP_PASSWORD` gate on the welcome page.

## Key Source Files

### Types
`src/types/index.ts` — all TypeScript interfaces. Key types:
```typescript
type ProjectStatus = 'in_progress' | 'waiting_payment' | 'completed'
type ProjectType = 'retainer' | 'one_time'
```

### Hooks
- `src/hooks/useProjects.ts` — project CRUD + realtime
- `src/hooks/useCalendarEvents.ts` — event CRUD + assignees
- `src/hooks/useProjectNotes.ts` — debounced (500ms) note save
- `src/hooks/useUsers.ts` — user fetch + avatar upload to Supabase Storage

### Components
- `src/components/layout/AppLayout.tsx` — root layout, wires everything together
- `src/components/sidebar/ProjectCardList.tsx` — project list with filter tabs (All/Retainer/One-time), drag-reorder, status drag-drop
- `src/components/sidebar/ProjectPanel.tsx` — slide-in drawer (portal-based) with Tasks / Notes / Financials tabs
- `src/components/sidebar/CommandBar.tsx` — AI free-text input, POSTs to `/.netlify/functions/ai-command`
- `src/components/calendar/CalendarView.tsx` — FullCalendar integration

### Netlify Function
`netlify/functions/ai-command.ts` — receives `{ message, projects, currentDate }`, calls Gemini 2.0 Flash with function calling, returns a structured action:
```
add_task | complete_task | set_deadline | update_note | change_status | create_event | change_type | message
```

## Project Logic Notes
- **Hours**: `src/utils/hours.ts` — events with `exclude_from_hours=true` contribute 0 hours. Multi-user events multiply duration by assignee count.
- **Sort order**: Projects use `sort_order` for manual drag ordering within a status section. If no manual order is set, they auto-sort by closest deadline first.
- **Drag behavior**: drag within same status section = reorder; drag to different section = change status.
- **Colors**: 12 preset soft colors in `src/utils/colors.ts`. Text color (black/white) auto-calculated from luminance.

## Running Locally
```bash
npm install
npm run dev       # starts Vite dev server
npm run build     # TypeScript check + build to dist/
```

For Netlify functions locally: `netlify dev` (requires Netlify CLI).

## Error Handling in Netlify Functions
Always expose the actual error message in API responses (never hide it with a generic message). Use:
```ts
body: JSON.stringify({ action: 'message', message: `Error: ${err instanceof Error ? err.message : String(err)}` }),
```

## Version History
- `v1.0` tag on `main` — stable version with: project management, calendar, financials, AI command bar, project types (retainer/one-time), deadlines, drag-reorder
