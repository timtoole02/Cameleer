# Llama 3.2 1B/3B unique-chat perf/RSS evidence — 2026-05-05

Public sanitized summary for bounded unique-chat benchmark/RSS sampling on the exact Llama 3.2 1B and 3B Instruct Q8_0 rows.

Result: PASS — both rows completed four measured unique chat requests after two warmups, with hot weight-cache measured runs and RSS milestones recorded.

Boundary: This closes only the bounded unique-chat memory/perf envelope box for the exact Llama 3.2 1B/3B Instruct Q8_0 rows. It does not promote broad/full Llama-family support, neighboring rows, other quantizations, larger context buckets, arbitrary GGUF/Jinja template execution, production throughput, or portability.
