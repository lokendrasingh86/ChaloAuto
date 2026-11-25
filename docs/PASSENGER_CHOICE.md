# Passenger choice: setup and verification

Implementation and release verification for `feat/passenger-choice-20261125`.
Includes the prior demo-reliability repairs. Render deployment status is checked separately from local test results.

## Behavior

Passengers see up to four genuinely feasible drivers, with the lowest System-Aware Balanced score first.
They may select any option. Cards show estimated pickup, onboard/reserved/free seats, quote, real review average/count,
and a familiar-driver badge only after a completed ride. Ratings and familiarity do not alter recommendation scores.
Unavailable, stale, full, legacy-busy or infeasible drivers are excluded; four cards are not guaranteed.

Browsing does not reserve a seat. A quote lasts 30 seconds; selecting it creates a separate 30-second response window
and reserves one seat. Driver rejection/expiry returns refreshed choices, without automatic reassignment. PostgreSQL
row locks, versions and unique pending-offer indexes protect concurrent reservations and process restarts.

The remaining stop order is preserved when inserting a pickup/drop-off. Each existing confirmed passenger has a
**120-second cumulative positive added planned drop-off delay budget**. Acceptance charges that durable budget;
cancellation does not reset it. The joiner's initial onboard distance is limited to 1.5 times direct road distance.
Co-located stops share a 30-second dwell. Reserved seats count until actual drop-off, even if a later pickup is planned.
Revalidation preserves the displayed feasible stop ordering, removing only already-visited old stops; it does not
silently re-rank against a different driver collection. Choice rides proceed `Requested -> Accepted -> PickedUp -> Completed`; only unboarded rides can be cancelled.
The accepted quote stays fixed as other passengers join or cancel. Old unfinished rides retain the Legacy planner.

## Routing and demo assumptions

`OSRM_BASE_URL` selects a compatible route/table service, defaulting to the public OSRM demonstration endpoint.
There is a shared one-request-per-second queue, coalescing, bounded ten-second requests and five-minute caching.
Public routing receives only light manual demo usage, never fixture tests or simulation batches. It provides generic
road timings, **not live traffic or an auto-rickshaw-specific travel model**. Routing failure returns 503 and a retry state.

User points must snap within 25 metres and lie within one kilometre of the configured full road-route geometry.
The route defaults to `Connaught Place to IGI Airport` (`CHOICE_ROUTE_NAME`). Geometry is cached on that Route record;
clear/rebuild it if an administrator changes the configured corridor endpoints. Pickup estimates expose the timestamp
of their own routing matrix. Attribution links appear with the options.

A driver needs an available profile on that route and a location update within 60 seconds. Bring real driver sessions
online with GPS permitted before searching; parked drivers request fresh GPS fixes every 20 seconds, with no timestamp
refresh on failed or cached reads. Old seed records alone are not fresh driver locations. The existing seed
assigns drivers to different routes, so it does not provide four online CP drivers. The automated browser fixture below
creates four isolated test drivers, including an occupied one. Its coordinates/times are synthetic and are never sold as
live road estimates. Existing "Simulate driving" is an illustrative straight-line demo; it is not road navigation.
Tracking continues on an ongoing ride when a driver turns off availability for further requests.

## Before a later deployment

1. Review this branch and configure the normal backend database/auth/CORS settings and frontend `VITE_API_URL`.
2. Generate the Prisma client and apply the additive `20261125000000_passenger_choice` migration with
   `npm exec -- prisma generate` and `npm run db:deploy` in Backend. Keep the previous migrations too.
   Existing records default to Legacy and are not converted into partially initialized Choice plans.
3. Set `CHOICE_ROUTE_NAME` if needed and a suitable `OSRM_BASE_URL` for the expected usage. Start the normal backend
   matching loop; it also sweeps expired holds, while booking/current-state endpoints enforce expiry directly.
4. Deploy backend and frontend together. Render static hosting also needs the SPA `/* -> /index.html` rewrite described
   in `BUGFIX_VERIFICATION.md`; the local `Frontend/render.yaml` does not change an existing dashboard automatically.

Do not run the repository's destructive `npm run seed` against an existing live database as a migration step.

## Reproduce checks

From repository root:

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd --prefix Frontend run build
```

Database integration and browser fixtures reset their database tables. They refuse hosts other than loopback and
database names outside `chalo_choice_*`. Use a dedicated disposable database; do not run both suites concurrently.
Apply all migrations to that database before testing:

```powershell
cd Backend
$env:CHOICE_TEST_DATABASE_URL='postgresql://TEST_USER@127.0.0.1:TEST_PORT/chalo_choice_disposable'
$env:DATABASE_URL=$env:CHOICE_TEST_DATABASE_URL
npm.cmd exec -- prisma migrate deploy
npm.cmd run test:integration

# Existing installed Playwright and Chrome are needed; no runtime dependency added.
$env:PLAYWRIGHT_MODULE_PATH='C:/path/to/installed/node_modules/playwright'
npm.cmd run test:browser
npm.cmd run test:browser:focused
```

The browser harness owns ports 8193/5193 and an ephemeral local OSRM HTTP fixture, starts real Express/Socket.IO/Vite,
and closes those processes after testing. Its only substituted boundary is road routing; auth, roles, HTTP, sockets,
Prisma, PostgreSQL and Chrome exercise the real application. `CHOICE_BROWSER_ARTIFACTS` optionally sets screenshot output.

## Verified 26 November 2026

| Check | Result |
| --- | --- |
| Backend algorithm/routing/transition/API-auth tests | 60 passed |
| Real PostgreSQL integration | 20 passed, none skipped |
| Backend and frontend type checks | Passed |
| Frontend production build | Passed |
| Real browser + backend + local DB | Passed: four mixed-occupancy options, non-top choice, live driver offer, accept, pickup, reload both sides, explicit Socket.IO reconnect, unavailable ongoing drop-off, locked fare, rating/history/earnings and role/input guards |
| Focused browser regressions | All three repository fixtures passed: expired quotes/holds, decline/cancel refresh, server clock skew, late selection response, PickedUp recovery, tracking while unavailable, canonical next-stop gating, attribution object rendering, parked fresh-GPS polling and cleanup |
| Independent code review | Attribution rendering bug fixed and retested; follow-up found no further important issue |
| One optional public route smoke | Passed: CP–IGI 19,198.6 metres, 1,372.3 generic seconds, 434 geometry points; not a traffic validation |
| Changed frontend strict lint | Existing 42 errors / 3 warnings remain; new DriverOptions component is clean |

Database coverage includes same-option replay, last-seat races, one-passenger/two-driver races, road estimates in flight,
location ageing before commit, durable expiry in a fresh service instance, stop lifecycle/authorization, cumulative budget
accounting without reset, occupied eligibility, fare immutability, honest ratings/familiarity, road-snap rejection,
legacy-versus-choice contention, routing outage, pickup-versus-cancel and duplicate completion races, expiry while
acceptance routing is in flight, and preservation of the displayed feasible proposal. Pure tests include the exact
90+30 accepted / 90+31 rejected boundary.

Build still warns that local Node 22.11 is below Vite's supported 22.12+, that Browserslist data is old, and that the JS
bundle exceeds 500 kB. Use the deployment's Node 22.16+ runtime. Full lint is not green; these existing warnings/errors
are not a claim of production hardening or large-scale routing validation.

Local test evidence: `C:\Users\HP\ChaloAuto-choice-verification-20261125`.
Reproducible focused browser scripts: `Frontend/integration/*-choice.browser.cjs`, started through
`Backend/integration/focused.browser.ts`. They use `PLAYWRIGHT_MODULE_PATH` and `CHOICE_FRONTEND_URL` instead of machine-specific paths.
The private PostgreSQL fixture lives outside Git under `C:\Users\HP\ChaloAuto-local-20261125`, port 55439;
the disposable database is `chalo_choice_20261125`. No credentials or real user data are committed.
