# Altis Forecast — Frontend (React + Vite)

Role-based dashboard for the 13-week cash-flow forecast. "Roofing editorial"
design system (slate + tile-copper, Archivo + mono, weather sky band). Talks to
the FastAPI backend over a JWT-authenticated REST API.

## Stack

- **React 18 + Vite** · **Tailwind** · **Recharts**
- **html2pdf** (lazy-loaded) for client-side report export
- JWT auth (token in `localStorage`), role → view routing

## Setup

```bash
cd frontend
npm install
cp .env.example .env       # set VITE_API_URL
npm run dev                # http://localhost:5173
npm run build              # production build → dist/
npm run preview            # serve the build locally
```

## Environment

| Var | Purpose |
|-----|---------|
| `VITE_API_URL` | Backend base URL (e.g. `http://localhost:8000` or the Railway backend URL). **Inlined at build time** — set it before `npm run build`. |

## Structure

```
src/
├── api.js                # fetch wrapper + JWT header + error envelope
├── auth/AuthContext.jsx  # login / me / logout, token storage
├── altis/                # format.js (colors, eur, opcos), hooks.js, reports.js (PDF)
├── components/           # TopBar, ScenarioToggle, CovenantCard, AuditModal,
│                         #   ReportMenu, SavingsPanel, primitives, icons, ChartTooltip
└── views/                # Login, Onboarding (ERP sync), PEBoard, CFOView, OpcoMD, ProjectLead
```

## Views by role

| Role | View | Scope |
|------|------|-------|
| `pe_board` | PEBoard — covenant gauges, 3-scenario cumulative, opco cards, savings | all opcos |
| `cfo` | CFOView — weekly inflow/outflow + cumulative, click a bar → audit drill-down | all opcos |
| `opco_md` | OpcoMD — WIP, cash, project table | own opco |
| `project_lead` | ProjectLead — milestones, weather risk, materials vs billing | own opco |

After login, an **Onboarding** screen shows the connected ERPs and runs a sync
animation (`/recompute`) before the dashboard.

## Reports

`ReportMenu` downloads a weekly/monthly PDF (client-side via html2pdf). The prose
sections (executive summary, covenant, scenarios, risks) come from the backend
`/api/reports/narrative` endpoint — written by Claude over real data, with a
deterministic fallback. Tables and figures stay deterministic.

## Deploy (Railway)

Connected to GitHub (`Santy1422/hackaton`, root dir `frontend`, branch `main`) →
auto-deploys on push. Build: `npm run build`; served with `npx serve -s dist`
(see `railpack.json`). Set `VITE_API_URL` to the backend's public URL.

Live: https://frontend-production-5272f.up.railway.app
