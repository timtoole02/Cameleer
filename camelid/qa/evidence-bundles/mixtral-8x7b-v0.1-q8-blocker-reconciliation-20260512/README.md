# Mixtral blocker reconciliation — 2026-05-12

Local-only evidence review at `bc7af7335b9b527aedd429d70e899bd727612c40`.

This bundle reconciles older Mixtral exact-row promotion/checksum artifacts with later long-output blocker artifacts. It is not new runtime validation and does not use SSH or any validation host.

Conclusion: Mixtral remains `active_validation_partial_runtime` / unsupported beyond bounded one-token backend MoE runtime evidence. Gate 9A diverged by generated token index 9, and the continuation probe recorded a partial failure plus a hung backend call.
