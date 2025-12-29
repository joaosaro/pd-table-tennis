# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server with HMR (port 5173)
npm run build      # Production build
npm run start      # Run production server
npm run typecheck  # Generate types + TypeScript check
```

## Architecture

This is a **React Router v7** (formerly Remix) full-stack app with SSR enabled.

### Key Structure
- `app/routes.ts` - Route configuration (file-based routing)
- `app/root.tsx` - Root layout with error boundary
- `app/routes/` - Route components
- `app/app.css` - Global styles (plain CSS with CSS variables, no Tailwind)
- `.react-router/types/` - Auto-generated route types

### Path Aliases
Use `~/` to import from `app/`:
```typescript
import { Welcome } from "~/welcome/welcome";
```

### Styling
- Plain CSS with CSS variables for theming
- Dark mode via `prefers-color-scheme: dark` media queries
- Font: Inter (loaded from Google Fonts in root.tsx)

## Supabase

Packages installed (`@supabase/ssr`, `@supabase/supabase-js`) but not yet integrated. When implementing:
- Create client initialization in `app/lib/supabase.ts`
- Use `@supabase/ssr` for server-side auth with cookie-based sessions
- Environment variables needed: `SUPABASE_URL`, `SUPABASE_ANON_KEY`

## Deployment

Docker multi-stage build configured in `Dockerfile`. Production uses `react-router-serve`.
