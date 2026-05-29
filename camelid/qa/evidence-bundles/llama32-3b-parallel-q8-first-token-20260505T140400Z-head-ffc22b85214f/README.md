# Llama 3.2 3B parallel Q8 first-token perf evidence — 2026-05-05

Public sanitized summary for the exact **Llama 3.2 3B Instruct Q8_0** opt-in parallel Q8 first-token runtime direction probe.

Result: PASS — validation gates passed, then the exact 3B row ran one warmup plus one measured first-token request with `BACKENDINFERENCE_PARALLEL_LINEAR=off` and `on`.

Green row+box: **Llama 3.2 3B Instruct Q8_0 → performance lane → opt-in parallel Q8 first-token runtime direction sub-box**.

Measured direction:

- Generate time: `13960` → `12200` ms (-12.61%).
- Layer time: `13847.54` → `12110.67` ms (-12.54%).
- Logits time: `105.95` → `81.75` ms (-22.84%).
- FFN total: `10326.48` → `8912.14` ms (-13.7%).
- Max sampled backend RSS: `283.57` → `282.97` MiB.

Boundary: This closes only the exact 3B opt-in parallel Q8 first-token runtime direction sub-box. It is not a production-throughput, portability, arbitrary-template, larger-context, neighboring-row, or broad/full-support promotion.
