# Goals

## Current Phase: Phase 2 — Technical Excellence

**Priority order (P1):**
- Error handling: graceful degradation, retry logic, truthful connection reporting across all adapters.
- Stability: keep `main`, CI, and release builds operational through the stabilization phase.

**Medium term (P2):**
- Performance: profile and optimize for 5k–10k+ torrent handling; virtualized state (window-based fetching).
- Accessibility: WCAG 2.1 AA compliance.
- WebSocket keepalive (Chrome 116+ persistent connections).

## Exit Criteria for v1.0

- Error handling and stability work complete.
- Chrome and Firefox store submissions pass review.
- All P1 roadmap items resolved.
- No open CI failures on `main`.
