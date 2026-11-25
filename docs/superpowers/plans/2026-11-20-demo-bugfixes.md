# Demo reliability bugfix plan

Goal: fix the reviewed implementation defects without adding features or changing the intentional CP–IGI demonstration route.

Scope: Profile render loop and edit state; driver profile response mapping; missed socket events after reconnect; simulation API's missing-data fallback and invisible bars; root typecheck path; Render SPA rewrite artifact; stale ride-state writes. Keep placeholder support/settings out of scope: implementing them would be new functionality. Do not change matching strategy, fares, authentication policy, simulation measurements, or production settings.

Use the existing separate review checkout on branch fix/demo-reliability-20261120. No additional worktree is needed. Execute sequentially with systematic debugging and red/green checks; no new production dependencies.

- [x] Task 1: reproduce Profile navigation/editing and driver display/reconnect failures using a local browser fixture, then fix the affected components. Test actual UI navigation and controlled socket reconnect against synthetic HTTP/Socket.IO state, without modifying the live deployment.
- [x] Task 2: preserve the API summary contract using the already-shipped JSON fallback, fix the zero-height bars and typecheck command, and supply Render's SPA rewrite in an optional Frontend/render.yaml Blueprint. Manually created services still require the dashboard rule; no deployment is changed locally. First run the existing failing API/typecheck checks; verify after repair. Do not fabricate missing Python sources or update research results.
- [x] Task 3: add controlled interleaving regressions around acceptance, cancellation, completion, decline/expiry and rating; guard database writes by their current state/assignment and reject stale operations. Use Prisma delegate stubs for deterministic state transitions, disclose that these do not certify PostgreSQL multi-process behavior.
- [x] Final: full backend test suite, both type checks, frontend production build, targeted lint, browser regression replay, inspect complete diff. Record existing unrelated lint debt and any limits. Leave deployment unchanged; report the exact reviewed result before asking about publication or features.

Regression focus: navigation after editing or cancellation, singleton socket listener cleanup, completed/cancelled/reassigned rides not resurrected by stale writes, explicit simulation data failures not hidden by fallback, SPA rewrite recorded in the optional Render Blueprint. No live Render rewrite change is claimed.

Execution notes: the source review identified two refresh races after the first repair. Added controlled delayed-response regressions and generation guards. Final results: 30 backend tests and seven browser checks pass, both type checks and build pass. Existing unrelated lint debt and Node version warning are documented in BUGFIX_VERIFICATION.md. No live deployment or feature work performed.
