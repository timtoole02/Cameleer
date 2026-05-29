## Summary

Describe the change in 2-4 bullets.

## Why this change exists

Explain the user-visible or engineering reason for the change.

## Validation

- [ ] `git diff --check`
- [ ] `cargo fmt --all -- --check`
- [ ] `cargo test --all-targets --all-features`
- [ ] `cd frontend && npm run build`
- [ ] Other evidence attached below

## Public-repo privacy check

- [ ] No private hostnames, SSH commands, user home paths, key paths, local validation details, raw SSH stderr, or raw infrastructure failure output are included
- [ ] Remote validation blockers are summarized generically, for example: `Remote Linux x86_64 validation was unavailable during this cycle; no fresh same-host timing/parity claim is made.`
- [ ] `bash scripts/check-public-scrub.sh`
- [ ] `node scripts/audit-evidence-bundle-privacy.mjs --strict`

## Support-contract check

- [ ] This PR does not overclaim support
- [ ] TinyLlama Q8_0 remains the current full-support gate; exact Llama 3.2 1B/3B and Llama 3 8B Q8_0 rows stay limited to their documented exact-row smoke envelopes unless exact new evidence is included
- [ ] Any 1B / 3B / 8B wording stays aligned with `COMPATIBILITY.md`, `STATUS.md`, and `/api/capabilities`, including bounded-pack caveats for 8B broader 50-token, 512-context, compact template-shapes, and measurement-only lazy-Q8 hot-path evidence

## Evidence / artifacts

Link logs, screenshots, parity outputs, or notes here.

## Docs impact

List any README / compatibility / status / roadmap updates included in this PR.
