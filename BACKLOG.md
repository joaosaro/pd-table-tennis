# Project Backlog

### [improvement-1735556400] Allow adding players after league starts (on-demand match creation)

- **Priority**: high
- **Created**: 2024-12-30
- **Status**: open

Currently all league matches are pre-created in the database when the tournament starts, preventing new players from being added mid-tournament.

**Proposed change:**
- Remove upfront match creation for league phase
- Calculate possible matches dynamically (all player pairs)
- Create match records only when editor/admin records a result
- Editor/admin selects two opponents from a list to record a match

This enables adding new players at any point during the league phase.

---

### [improvement-1735556401] Allow deleting players

- **Priority**: high
- **Created**: 2024-12-30
- **Status**: open

Admin should be able to delete players from the tournament. Need to handle cascade deletion of associated matches.

---
