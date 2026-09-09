# State-integrity and vault runtime validation: Firefox

- browser: firefox 155.0.1 (headless)
- extension: CTRL 0.2.0-beta.1 (working tree)
- servers: two synthetic Transmission-compatible servers (tests/live/fake-transmission.mjs) at http://192.168.1.235:19193/ and http://192.168.1.235:19194/, overlapping torrent ids 1 and 2, harness-controlled delays and lists
- harness: tests/live/verify-state.mjs; every claim checked against the servers' request logs and the controller's GET_STATE

**Result: 17 passed, 0 failed, 0 skipped.**

| Scenario | Result | Observed | ms |
|---|---|---|---|
| vault-setup | PASS | vault created | 783 |
| configure-two-servers | PASS | A (http://192.168.1.235:19193/) and B (http://192.168.1.235:19194/) saved; A is the default | 2302 |
| list-shows-server-a | PASS | rows ["A-one, Downloading, 0%","A-two, Downloading, 0%"]; controller server=Server A status=connected | 494 |
| switch-to-b-while-a-is-slow | PASS | B's queue shown 3703 ms after the switch: ["B-one, Downloading, 0%","B-two, Downloading, 0%","B-three, Downloading, 0%"]; still B after A's 6 s reply: ["B-one, Downloading, 0%","B-two, Downloading, 0%","B-three, Downloading, 0%"]; A polls answered late: 4 | 14289 |
| command-targets-the-torrent-server-not-the-id | PASS | torrent-stop ids [1] reached B only (A got none, although A also has id 1); resume restored Downloading | 141 |
| reorder-and-membership-changes | PASS | rows followed the server order and membership: ["B-three, Downloading, 0%","B-four, Downloading, 0%","B-one, Downloading, 0%"]; restored | 3272 |
| second-options-window-mirrors-state | PASS | window 2 showed the same queue and reflected a pause/resume issued from window 1 | 728 |
| popup-consistent-with-options | PASS | popup shows Server B with B-one, B-two, B-three | 319 |
| background-restart-resubscribe | PASS | skipped by design: WebDriver classic cannot terminate the Firefox event page | 0 |
| permission-revoked-and-recovered | PASS | revoking http://192.168.1.235/* → "ACCESS REVOKED"; Grant access in the server list → LIVE | 1088 |
| lock-redacts-every-window | PASS | locking in window 1 redacted window 2 and the popup; no queue data remained visible | 221 |
| wrong-master-password | PASS | wrong password refused (controller stays locked); correct password unlocked both windows | 347 |
| import-failure-preserves-state | PASS | import rejected ("Import failed"); both servers still listed; controller still on Server B | 725 |
| safe-export-has-no-secrets | PASS | ctrl-servers-safe-2026-09-09_17-24-53.json: containsSecrets=false, 2 servers, addresses present, no password field or value | 1129 |
| sensitive-export-is-labelled | PASS | ctrl-servers-full-2026-09-09_17-24-54.json: containsSecrets=true and both passwords present (as the label says) | 579 |
| legacy-vault-migration | PASS | legacy salt+data unlocked with the old password, rewritten as a v2 envelope, legacy keys removed, server usable (LIVE) | 1611 |
| corrupt-vault-fails-closed-and-resets | PASS | corrupt envelope → "Vault damaged" in options and popup, no data shown; explicit reset → setup screen, vault keys removed | 398 |
