# Demo reliability repairs — 20 November 2026

This patch repairs reviewed behavior. It does not add a booking mode, change matching or fares, implement placeholder controls, or alter the intentional Connaught Place–IGI demonstration route.

## Changes

- Profile initializes its user state once and updates it after saving. It no longer continually resets state from a freshly parsed object.
- Driver display reads the nested driver/vehicle fields and top-level user returned by the existing profile endpoint.
- Both dashboards reload their existing state on socket reconnection. Passenger recovery checks the previous ride for a missed completion. Generations prevent old responses from overwriting newer actions/events; listeners are removed on unmount.
- Acceptance claims the selected request and remaining requested pool in a transaction. Completion, cancellation, decline, expiry and rating writes check current state/assignment instead of overwriting stale snapshots.
- With CSV results absent, the simulation API serves the same historical JSON snapshot already shipped by the frontend. A Backend/data copy supports Backend-only deployments; an equality test prevents drift. This does not restore missing Python sources or validate/recompute historical numbers.
- Chart bars use an explicit drawable height. The root typecheck resolves the frontend tsconfig from the correct working directory.

## Verification

The checks to rerun are `npm test`, `npm run typecheck`, `npm --prefix Frontend run build`, and the local browser regressions. Results and the replay script are saved in `C:\Users\HP\ChaloAuto-fix-verification-20261120`.

Final local results: 30/30 backend tests; 7/7 browser regressions, including delayed-response races; both type checks; production build; and targeted Profile/Simulation lint all passed. The final independent source review found no further blocking issues in the repaired races. No claim of full frontend lint cleanliness is made.

Stale-write tests run real service functions with only the Prisma database boundary replaced, to schedule competing writes precisely. They do not certify PostgreSQL multi-process concurrency. Browser checks use synthetic HTTP and real Socket.IO fixtures through existing Playwright/Chrome tools, without modifying the deployed database.

Local Node 22.11 emits Vite's version warning; Render should use Node 22.16 or a supported newer LTS, as configured for the demo. Unrelated existing frontend lint debt is outside this patch; the entire lint suite is not claimed clean.

## Deployment

No push, merge, production database write, service creation or Render configuration change is performed by this local patch.

The frontend needs a Render Rewrite with Source `/*` and Destination `/index.html` for refreshes/direct links. Optional `Frontend/render.yaml` records that rule. A manually created static site does not read it merely because it is committed: save the rule in its Dashboard or explicitly manage the existing site with the Blueprint. Do not create a duplicate service just to apply it.

Keep existing backend database/environment values. The build command must not run `npm run seed` on every redeploy: that script deletes data.

After an approved deployment, recheck frontend `/login`, backend `/health` and `/api/simulation/summary`, then replay the normal passenger/driver demo. The backend root intentionally has no homepage; `Cannot GET /` there is expected.

## Remaining limits

Support delivery, payouts, onboarding, payment and unfinished settings remain unimplemented. The single-process matcher, concurrent duplicate-request creation, crash recovery and scalability require separate integration work. Static simulation data is not newly validated research evidence.
