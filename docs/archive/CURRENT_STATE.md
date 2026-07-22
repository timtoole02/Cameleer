# Current State of Cameleer Repository

This document summarizes the state of the Cameleer repository immediately following Phase 1 (Stabilize Repo) of the Production Rebuild Mandate.

## Technical Debt & Broken Build Steps

### 1. Legacy Scripts & Hacks
Prior to the rebuild mandate, the project relied heavily on ad-hoc scripts to mutate the React codebase via string replacement (e.g., `fix_app.cjs`, `replace_jsx.cjs`, `extract_tabs.cjs`). These have now been quarantined into `tools/legacy-repair/`. This signals a transition from "scripted monkey-patching" to proper architectural refactoring.

### 2. Frontend State Management
`App.tsx` contains a massive prop-drilling structure where nearly every piece of state from `useAppStore` is passed explicitly into child components (and some inline rendering blocks). This makes the root component incredibly bloated and difficult to maintain. A proper context provider or modularized state architecture is needed.

### 3. File Bloat
The quarantined `jsx_body.tsx` is an inline file of over 250KB, indicating past issues with UI complexity being dumped into single massive files rather than modular React components. While this specific file is quarantined, we must ensure future components are strictly modular.

### 4. Build Processes
- **Frontend**: The `npm run build` process succeeds, but there is no `lint` script defined in `package.json`. A proper ESLint/Prettier configuration is necessary for a production-grade codebase.
- **Backend**: The Tauri Rust backend `cargo build` and `cargo test` commands currently fail due to macOS AppleDouble resource forks (`._` files) getting picked up by the Tauri permission builder (e.g., `failed to read file .../._default.toml: stream did not contain valid UTF-8`). This requires a `cargo clean` and a script to purge `._` files from the target directory before building. 

## Next Steps readiness
With the legacy scripts quarantined, the codebase is significantly cleaner but fragile. Any new features must be built via proper React components and Rust modules rather than one-off mutating scripts. The next phase will establish a robust testing and continuous integration foundation.
