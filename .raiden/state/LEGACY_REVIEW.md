# Legacy Review

These repo-local agent surfaces predate the current RAIDEN Instance layout.
Review them before assuming RAIDEN migration is complete.

## Detected Legacy Artifacts

- `agent-ledger`
  Status: `active-legacy`
  Reason: Legacy continuity/state area should be reviewed for mapping into .raiden/state/

## Review Actions

- Map legacy prompts into `.raiden/local/prompts/` where appropriate.
- Map legacy continuity/state into `.raiden/state/` where appropriate.
- Retire or archive stale legacy paths only after operator review.
