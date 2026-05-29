# Frontend Gemini-like chat surface evidence

Captured: 2026-05-08T13:52Z

## Artifact

- `camelid-gemini-chat-surface.png` — 1440x1120 screenshot of the cleaned Gemini-like Camelid chat landing state.

## What changed

- Made the empty chat view visibly product-like: centered Camelid wordmark, softer glow stage, compact readiness ribbon, proof cards, and a rounded Gemini-like composer.
- Kept support/readiness honest: chat unlocks only when runtime health, generation readiness, and an exact supported compatibility row agree.
- Simplified visible copy from debug-first wording to product-facing preview wording while preserving the 16-token bounded-output disclosure.
- Used backend-provided model names in the frontend model list so screenshots can show friendly names instead of raw ids.

## Capture setup

Mock backend:

```bash
MOCK_PORT=51952 node qa/evidence-bundles/frontend-gemini-chat-surface-20260508T1352Z/mock-backend.mjs
```

Build/serve:

```bash
cd frontend
VITE_BACKENDINFERENCE_API_BASE=http://127.0.0.1:51952 npm run build
npm run preview -- --host 127.0.0.1 --port 4194
```

Screenshot:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless \
  --disable-gpu \
  --hide-scrollbars \
  --no-first-run \
  --user-data-dir=/tmp/camelid-screenshot-profile-1352f \
  --window-size=1440,1120 \
  --screenshot=qa/evidence-bundles/frontend-gemini-chat-surface-20260508T1352Z/camelid-gemini-chat-surface.png \
  'http://127.0.0.1:4194/'
```

## Validation

- `npm run build` passed.
- Final screenshot was generated from the built preview against the mock readiness/capabilities endpoints.
- Visual check found no serious visible blockers; remaining visible disclosures are intentional honesty boundaries, not styling blockers.
