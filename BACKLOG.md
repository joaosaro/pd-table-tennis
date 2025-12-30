# Project Backlog

### [improvement-1735556400] Allow adding players after league starts (on-demand match creation)

- **Priority**: high
- **Created**: 2024-12-30
- **Status**: closed

Implemented on-demand league match creation:
- New route `/editor/record-league` for selecting two players and recording result
- League progress shown in editor matches page with remaining match count
- Removed upfront league match generation from admin
- Players can now be added at any time during the league phase

---

### [improvement-1735556401] Allow deleting players

- **Priority**: high
- **Created**: 2024-12-30
- **Status**: closed

Already implemented in `app/routes/admin/players.tsx`. Delete button exists with cascade deletion via DB schema.

---
