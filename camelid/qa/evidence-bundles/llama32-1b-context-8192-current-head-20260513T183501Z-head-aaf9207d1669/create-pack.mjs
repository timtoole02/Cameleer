import { writeFileSync } from "node:fs";
const phrases = [
  "alpaca keeps blue evidence",
  "llama records deterministic tokens",
  "vicuna checks bounded context",
  "guanaco preserves exact rows",
  "camelid audits public summaries",
  "rust module matches clean checkouts",
  "API route guards RSS milestones",
  "frontend gate reports generated text",
  "tokenizer samples prompt IDs",
  "prompt pack anchors claim boundaries",
  "checksum verifies support copy",
  "memory sampler limits local paths",
  "validation lane documents model hashes",
  "model row rejects runtime readiness",
  "Q8 tensor compares reference output",
  "context bucket stabilizes operator notes",
  "template shapes stay bounded",
  "portable host publishes portable claims only when tested",
  "throughput sample normalizes template shapes",
  "support ledger reviews green boxes",
];
const facts = [];
for (let i = 1; i <= 740; i++) facts.push(`Fact ${String(i).padStart(3, "0")}: ${phrases[(i-1)%phrases.length]}.`);
const pack = {
  schema: "camelid.llama3.prompt-pack.v1",
  pack_id: "llama3-context-8192-smoke-v1",
  description: "TPM current-head proof attempt for exact Llama 3.2 1B Instruct Q8_0 beyond the checked 4096 bucket. Synthetic compact-template recall prompt; claim boundary remains exact-row and measured by the parity report.",
  target_context_window: 8192,
  defaults: { max_tokens: 5, render_mode: "compact" },
  prompts: [{
    id: "roughly-8192-token-recall",
    note: "Canonical Ubuntu current-head attempt to determine whether the exact 1B row can move beyond 4096 or must be blocked with proof.",
    messages: [
      { role: "system", content: "You are checking deterministic local model parity for a bounded 8192-context bucket. Answer with the final requested marker only." },
      { role: "user", content: `Context block start. ${facts.join(" ")} Repeat marker: CMLD-8192-CHECK. Context block end. What is the repeat marker?` }
    ],
    max_tokens: 5,
    render_mode: "compact",
    target_context_window: 8192,
  }]
};
writeFileSync(process.argv[2], JSON.stringify(pack, null, 2) + "\n");
