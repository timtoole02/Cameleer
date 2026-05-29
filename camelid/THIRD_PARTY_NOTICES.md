# Third-Party Notices

Last updated: 2026-05-01

## Scope note

This file records the third-party notices Camelid currently needs to keep visible in source and release distributions.

It is intentionally explicit rather than exhaustive today. Camelid should expand this notice set as the project adds more redistributed source, bundled binaries, shipped fixtures, or material third-party runtime and build dependencies. A broader dependency inventory may later live in a separate generated notice or SBOM workflow, but that future inventory does not replace the current obligation to preserve visible credit wherever Camelid's public evidence trail depends on external work.

Practical rule: documentation cleanup, branding polish, or repository renaming must not remove third-party acknowledgement when public claims, parity evidence, tokenizer references, or reference benchmarks still depend on that external work.

## Current credited reference work

Camelid is an independent Rust-native local inference project. Its implementation is original, but parts of its public credibility story — especially compatibility comparisons, tokenizer references, parity harnesses, and benchmark evidence — rely on important open-source reference work. Those references travel through the README, compatibility matrix, status ledger, and release-note claims whenever Camelid cites parity-backed evidence.

### llama.cpp / ggml

Camelid uses llama.cpp as a compatibility and parity reference for GGUF model behavior, tokenizer fixtures, and local inference validation. This is not incidental credit: those references remain part of Camelid's documented evidence trail and should stay explicitly credited wherever that evidence is summarized or redistributed.

- Project: <https://github.com/ggml-org/llama.cpp>
- License: MIT

```text
MIT License

Copyright (c) 2023-2026 The ggml authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Maintenance note

Keep this file in sync with any third-party source, binary, fixture, or reference tooling Camelid redistributes or materially depends on for public evidence. Documentation polish, branding cleanup, or repository renaming work must not remove these credits while the underlying technical reliance still exists.
