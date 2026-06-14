# Open Loops

## OL-001

- Title: Phase 2 — Error Handling
- Status: Open
- Why it matters: adapter connections can fail silently or mislead the user; truthful connection reporting and graceful degradation are P1 for the stabilization phase.
- Success condition: all adapters implement graceful degradation and retry logic; connection state is reported accurately to the user.

## OL-002

- Title: Stale VPN reference docs
- Status: Closed (2026-06-14)
- Severity: Low
- Why it matters: two docs still reference the deleted `VPNIndicator.tsx` — not a runtime issue but misleading to future readers.
- Files:
  - `docs/reference/carbon_ui_scope_manifest.md`
  - `docs/reference/tron_to_ctrl_carbon_runbook.md`
- Success condition: both files updated to remove the stale `VPNIndicator.tsx` references.
- Closed by: `VPNIndicator.tsx` removed from Zone B list in both files; commit a663320.

## OL-003

- Title: CTRL legacy agent-ledger migration
- Status: Closed (2026-05-15)
- Why it matters: pre-RAIDEN `agent-ledger/` held durable closeout notes that needed mapping into `.raiden/state/`.
- Closed by: agent-ledger contents mapped into `.raiden/state/` (DECISIONS.md, WORK_LOG.md); artifact-policy file discarded (RAIDEN structure makes it redundant); `agent-ledger/` directory removed; LEGACY_REVIEW.md closed.
