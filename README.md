# Cacsms Nexus

AI-Driven Autonomous Institutional Trading Ecosystem

Cacsms Nexus is being structured as an enterprise-grade autonomous institutional trading platform for future prop firm account operation, broker account supervision, MT5 control, computer vision analysis, institutional intelligence, multi-strategy orchestration, risk governance, and continuous optimization.

This phase creates the project foundation only. It does not implement live trading, AI models, MT5 execution, broker integrations, backend microservices, authentication, RBAC, database schemas, or live WebSocket infrastructure.

## Stack

- pnpm workspace
- Turborepo
- Next.js 15
- React 19
- TypeScript
- TailwindCSS
- Shadcn UI-compatible components
- Framer Motion
- Zustand
- TanStack Query
- Recharts

## Setup

Enable pnpm through Corepack:

```bash
corepack enable
corepack prepare pnpm@9.15.4 --activate
```

Install dependencies:

```bash
corepack pnpm install
```

Run the full workspace in development:

```bash
corepack pnpm dev
```

Run only the web app on port 3000:

```bash
corepack pnpm --filter @cacsms-nexus/web dev --port 3000
```

Build the workspace:

```bash
corepack pnpm build
```

Typecheck and lint:

```bash
corepack pnpm typecheck
corepack pnpm lint
```

## Folder Summary

- `apps/web`: initialized Next.js frontend foundation.
- `apps/admin-console`, `apps/operator-console`, `apps/vision-room`, `apps/monitoring-console`, `apps/mobile-app`, `apps/desktop-control-panel`: future application placeholders.
- `packages/ui`: reusable UI export boundary.
- `packages/design-system`: colors, spacing, radius, shadows, typography, and status tokens.
- `packages/types`: shared TypeScript workflow types.
- `packages/utils`: shared utility helpers.
- `services`, `ai`, `vision`, `automation`, `mt5`, `strategies`, `risk`, `execution`, `data`, `database`, `workers`: future backend, intelligence, automation, trading, and data domains.
- `monitoring`, `infra`, `deployment`, `configs`, `security`, `docs`, `scripts`, `tests`, `logs`: operational and platform support areas.

## Design Rule

The entire platform must use a white background throughout:

- Body background: `#FFFFFF`
- Main app background: `#FFFFFF`
- Dashboard background: `#FFFFFF`

Do not introduce a dark dashboard, black background, black sidebar, or dark trading terminal theme.

## Current Frontend Foundation

The landing dashboard at `apps/web/app/page.tsx` includes:

- Cacsms Nexus topbar with tagline, status badge, environment badge, emergency stop placeholder, and notification placeholder.
- White-background enterprise dashboard shell.
- Placeholder sidebar with only Executive Overview, Workflow Dashboard, System Setup, and Coming Soon modules.
- Workflow-first dashboard section with 23 responsive workflow preview cards.
- Reusable `WorkflowCard`, `StatusBadge`, `DashboardShell`, `Topbar`, and `SidebarPlaceholder` components.
- Mock workflow data, Zustand workflow state, and hooks for frontend-only status rendering.

## Next Implementation Phases

1. Expand the full navigation and module tree.
2. Add backend service contracts and API gateway scaffolding.
3. Add authentication, RBAC, and audit logging.
4. Add database schema and queue infrastructure.
5. Add MT5 bridge architecture without live execution.
6. Add AI, vision, and strategy module interfaces.
7. Add monitoring, health checks, and incident workflows.
