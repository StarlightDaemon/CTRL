# Open Loops

## OL-001

- Title: Phase 2 — Error Handling
- Status: Closed (2026-06-18)
- Why it matters: adapter connections can fail silently or mislead the user; truthful connection reporting and graceful degradation are P1 for the stabilization phase.
- Success condition: all adapters implement graceful degradation and retry logic; connection state is reported accurately to the user.
- Decisions (2026-06-18):
  - Test coverage: full parity across all nine adapters. ruTorrent and Synology receive the same depth as all others — AdapterError subclass instantiation, withRetry behavior under failure conditions, testConnection return contract, and adapter-specific error scenarios.
  - Commit strategy: per-adapter granularity. One lead commit covering AdapterError base class and shared withRetry infrastructure. One commit per adapter each containing implementation and tests. Ten commits total.
  - Architecture: Option A — enhanced local component state, no persistent error indicator.
  - Implementation gate (cleared): LifecycleAdapter.ts and BiglyBTSchema.ts error helpers read and summarized before any implementation code was written.
- Closed by: Phase 2 error handling shipped across all nine adapters — AdapterError subclasses, withAdapterRetry wiring (confined to the testConnection probe), the AdapterConnectionResult testConnection contract, and the BiglyBT PLUGIN_MISSING classifyError fix — in ten commits 2246e00, 990cd30, 8fe1003, de8357c, 5119dd9, f79bf03, d16d869, abb713f, a514274, b94f809 (full suite: 539 passed / 0 failed; VuzeAdapter inherits TransmissionAdapter coverage by extension).

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

## OL-004

- Title: Zero-touch localization pipeline — structural fix, AI translation deferred
- Status: Closed (2026-07-03)
- Why it matters: the pipeline's trigger path, `LOCALES_DIR`, and target-locale list were pointed at the wrong directory and an outdated/incorrect locale set, and the workflow carried an unneeded dependency-install step; the pipeline could not have run correctly as committed.
- Success condition: `extension/package.json`, `extension/scripts/translator/index.js`, and `.github/workflows/auto-localize.yml` all resolve to `extension/src/public/_locales`, target exactly `de, es, fi, fr, ru, zh_CN`, and the workflow runs with no install step and no external API dependency.
- Decisions (2026-07-03):
  - Real AI-backed translation was evaluated and deliberately deferred. OpenAI was rejected because it requires a separate billing relationship outside the current subscription; a direct Anthropic API integration has the identical problem.
  - Routing through Anthropic's own Claude Code GitHub Action using a subscription-tied OAuth token was identified as the one path that would stay inside the existing subscription, but its reliability for this specific unattended CI use case is unproven and was not pursued.
  - The pipeline currently writes a visible bracketed placeholder (`[locale] <English text>`) for any new untranslated key rather than a real translation, by design, until this is revisited.
- Closed by: `extract-i18n` --out-file corrected to `src/public/_locales/en/messages.json`; `LOCALES_DIR` corrected to `extension/src/public/_locales`; `TARGET_LOCALES` set to `['de', 'es', 'fi', 'fr', 'ru', 'zh_CN']`; zombie-key removal and new-key detection left intact; new-key branch restored to the original placeholder behavior (no OpenAI/Anthropic calls); workflow trigger path, dependency-install step removal, and direct-commit-via-`stefanzweifel/git-auto-commit-action` (pinned `b863ae1933cb653a53c021fe36dbb774e1fb9403`) all corrected to match.
