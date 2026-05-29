# Docs Support Contract / Host Audit

Time: 2026-05-20 23:32 UTC

Scope:

- `CONTEXT.md`
- `README.md`
- `COMPATIBILITY.md`
- `docs/**/*.md`
- `qa/validation-notes/**/*.md`

Purpose:

- Keep support-contract wording exact-row and evidence-scoped.
- Confirm public docs do not carry stale negative canonical Ubuntu host-access wording.
- Preserve the current host-reporting rule: negative canonical Ubuntu host status is current only when the canonical SSH probe was run in the same slice and failure stderr is cited.

Commands:

```bash
rg -n -S '<stale canonical-host negative-status phrase pattern>' CONTEXT.md README.md COMPATIBILITY.md docs qa/validation-notes -g '*.md' -g '*.txt'

rg -n -S '<support-contract and host-reporting spot-check phrase pattern>' CONTEXT.md README.md COMPATIBILITY.md docs -g '*.md'

git status --short --branch
```

Results:

- Stale host-failure scan: PASS; no matches in the scoped public docs and validation notes.
- Support-contract spot check: PASS; supported rows remain exact-row scoped, Mistral remains an active-validation row without a support label, and Mixtral remains partial backend-runtime evidence only.
- Host-reporting spot check: PASS; canonical host wording is limited to the reporting rule and docs instruct current slices to say when remote validation was not attempted.
- Remote validation was not attempted in this run.

Retain / reject:

- Retain as a docs-only evidence slice.
- No support, throughput, Ubuntu timing/profiling, portability, or default-on runtime claim is added by this slice.
