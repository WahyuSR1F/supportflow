# SupportFlow implementation plan

## Product outcome
A polished, responsive support-operations dashboard that demonstrates a multi-channel AI customer support product: unified inbox, AI-assisted responses grounded in knowledge sources, confidence-based human handoff, knowledge base management, widget preview, and architecture-aligned API surfaces.

## Structure
- `src/App.tsx`: seeded demo data, dashboard shell, inbox state transitions, knowledge base, widget preview, analytics, and reusable UI helpers.
- `src/styles.css`: responsive visual system for the signal-desk direction.
- `server/index.ts`: small same-origin API surface for tenant, conversation, message, handoff, document, widget, and Meta webhook routes.
- `python-ai-service/main.py`: FastAPI-shaped RAG service boilerplate for ingestion, retrieval, citations, confidence scoring, and health.
- `public/manus-routes.json`: current website route manifest.
- `app.config.ts`: project logo metadata for managed branding synchronization.

## Serving and cache approach
Preview runs a Vite-powered browser-rendered frontend on the managed development port. The app uses same-origin API routes in the included server surface; demo data is seeded in the client for a fast first load. Public versioned assets can be immutable in a future publish configuration; application HTML and API responses remain uncached/private because the dashboard is workspace-oriented and may contain tenant data.

## Verification
- Request the app and `/manus-routes.json` on the configured listener.
- Run TypeScript/Vite build checks.
- Inspect API route source for normalized Meta webhook, handoff, and RAG contracts.
- Validate responsive styles through source-level breakpoints and build output; screenshot/browser interaction is not required for this request.
