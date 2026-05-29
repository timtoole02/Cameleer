# Llama 3 8B lazy Q8 hot-path bench — 2026-05-05

Sanitized public summary for exact `llama3_8b_instruct_q8_0` lazy Q8_0 hot-path cost probes on the Ubuntu validation lane.

Scope is measurement only: retained-block microbenchmarks for representative first-layer FFN tensors and the swapped logical output projection shape. This does not broaden support beyond the exact row and prompt/API/WebUI evidence already documented.

A follow-up clean-temp-clone Ubuntu rerun at the same public head (`723a665`) applied only the measurement patch, passed `cargo fmt --check` and `cargo test -q q8_0 --lib`, reconfirmed the 8B GGUF SHA, and reproduced release-mode JSON timings within the same interpretation envelope. See `ubuntu_followup_validation` in `manifest.json`.
