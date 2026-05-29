# Llama 3 8B current-head bounded 1024/2048 evidence

Git head: `25968c48b74c278eda184d5f5999f51969b38212`

Passed: true

Rows:
- 1024: 881 prompt tokens, CMLD-102
- 2048: 1910 prompt tokens, CMLD-204

Boundary: Promotes only exact llama3_8b_instruct_q8_0 bounded 1024/2048 prompt packs at this git head; does not promote model-native/larger context, arbitrary templates, neighboring rows, broad 8B, full Llama-family support, portability, or production throughput.
