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

This is a **React Router v7** (formerly Remix) full-stack app with SSR enabled for managing a table tennis tournament with league and knockout phases.

### Key Structure
- `app/routes.ts` - Route configuration (file-based routing)
- `app/root.tsx` - Root layout with error boundary
- `app/routes/` - Route components (public, auth, editor, admin)
- `app/lib/` - Server utilities (auth, supabase, tournament logic, types)
- `app/components/` - Shared components (Header)
- `app/app.css` - Global styles (plain CSS with CSS variables, no Tailwind)
- `supabase/schema.sql` - Database schema with RLS policies
- `.react-router/types/` - Auto-generated route types

### Path Aliases
Use `~/` to import from `app/`:
```typescript
import { getUser } from "~/lib/auth.server";
```

### Styling
- Plain CSS with CSS variables for theming
- Dark mode via `prefers-color-scheme: dark` media queries
- Font: Inter (loaded from Google Fonts in root.tsx)

## Supabase

Fully integrated with `@supabase/ssr` and `@supabase/supabase-js`.

### Key Files
- `app/lib/supabase.server.ts` - Client initialization with SSR cookie handling
- `app/lib/auth.server.ts` - Auth helpers: `getUser()`, `requireUser()`, `requireRole()`
- `supabase/schema.sql` - Full schema with RLS policies

### Database Tables
- **players** - Tournament participants (name, department, tier 1-4)
- **users** - App users linked to Supabase Auth (email, role, player_id)
- **matches** - Tournament matches (phase, status, set scores, winner)
- **tournament_settings** - Singleton config (name, league_deadline, is_active)

### Environment Variables
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key

## Authentication & Roles

Google OAuth via Supabase Auth. First user becomes admin automatically.

- **Admin**: Full access - manage players, matches, users, settings, restart tournament
- **Editor**: Record match scores, view scheduled matches
- **Viewer**: Read-only access to standings, results, bracket

## Tournament System

### Scoring
Points awarded based on defeated opponent's tier:
- Tier 1 opponent: 4 points
- Tier 2 opponent: 3 points
- Tier 3 opponent: 2 points
- Tier 4 opponent: 1 point

### Phases
1. **League**: Round-robin (all players play each other once)
2. **Knockout**: Top 10 from league advance
   - Top 2 get byes to semifinals
   - R1: 3v10, 4v9, 5v8, 6v7
   - R2: Winners reseeded (best vs worst)
   - Semifinals: Top 2 seeds vs R2 winners
   - Final

### Standings Tiebreaker
1. Total points
2. Head-to-head result
3. Set differential
4. Total points scored

## Deployment

Docker multi-stage build configured in `Dockerfile`. Production uses `react-router-serve`.
