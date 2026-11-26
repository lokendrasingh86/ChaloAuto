# Passenger-choice implementation plan

**Goal:** Implement the user-approved driver-choice workflow locally, preserving prior repairs and leaving deployment unchanged.
**Spec:** ../specs/2026-11-25-passenger-choice-design.md (approved in chat).
**Architecture:** Pure remaining-route insertion/scoring, a cached road-routing boundary, transactionally persisted quotes/offers/stops, and React cards/lifecycle controls. PostgreSQL is the source of truth for capacity, expiry, route versions and locked fares.
**Tech:** Existing TypeScript/Express/Prisma/PostgreSQL/React/Socket.IO; existing installed Chrome/Playwright for browser verification.
**Execution:** Root implements service/database/integration sequentially; independent routing, pure planner and frontend adapters are delegated with exclusive file ownership under the parallel-agents skill. Root owns final integration and independent review. User explicitly approved implementation; no additional execution-method confirmation is needed.

## Constraints
- Up to four real feasible options, System-Aware Balanced recommendation; rating/familiarity are informational.
- Occupied autos permitted; hard 120 s cumulative future-booking delay per confirmed rider; retain initial 50% distance detour for joiner.
- Hold one selected seat/driver for 30 s; no browsing reservations, no silent reassignment; immutable accepted fare.
- Accepted -> PickedUp -> Completed for Choice rides; conservative onboard + reserved + held capacity.
- Road estimates without live traffic, 25 m maximum correction, 1 km configured road-corridor buffer, fresh position <=60 s, stop dwell 30 s/visit, cache 300 s, max one public routing request/s.
- No network routing inside database transactions; fail closed on unavailable road estimates; no live data/reset/migration/push.
- Legacy and Choice planners exclude each other's unfinished work.

## Shared contracts (authoritative for parallel tasks)

### Routing module: Backend/src/services/road-routing.ts
`Point` is existing algorithms/geo.ts [lat,lng]. Export:
```
interface RoadMatrix { points: Point[]; snappedPoints: Point[]; distances: number[][]; durations: number[][]; fetchedAt: string }
interface RoadRoute { points: Point[]; snappedPoints: Point[]; geometry: Point[]; distanceMeters: number; durationSeconds: number; fetchedAt: string }
interface RoadRouter { matrix(points: Point[]): Promise<RoadMatrix>; route(points: Point[]): Promise<RoadRoute> }
class RoutingUnavailable extends Error {}
class OsrmRouter implements RoadRouter { constructor(options?: { baseUrl?: string; fetcher?: typeof fetch; minIntervalMs?: number; cacheTtlMs?: number; timeoutMs?: number }) }
const roadRouter: RoadRouter
```
Input points remain original and index the directed matrices; snappedPoints expose provider corrections. Durations seconds, distances metres. Provider does not itself impose 25 m snap limit: caller does, because configured corridor endpoints and user inputs have different roles. route fetches full GeoJSON geometry; matrix accepts duplicates, validates arrays and no fallback_speed/guessed cells. OSRM_BASE_URL config, valid User-Agent, shared global <=1rps queue/coalescing/cache, bounded timeout. No public bulk tests.

### Planner module: Backend/src/algorithms/choicePlanner.ts
Export these exact types/functions (additional helpers private):
```
interface ChoiceStop { rideId: string; type: 'pickup'|'dropoff'; point: Point }
interface ChoicePassenger { id: string; pickup: Point; destination: Point; onboard: boolean; addedDelaySeconds: number }
interface DriverPlanInput { driverId: string; location: Point; capacity: number; passengers: ChoicePassenger[]; stops: ChoiceStop[]; matrix: RoadMatrix }
interface FeatureSums { pickupBurdenKm: number; routeDistanceKm: number; detourSum: number; vehicles: number; passengerCount: number }
interface InsertionPlan { driverId: string; stops: ChoiceStop[]; delayIncrements: Record<string,number>; pickupEtaSeconds: number; routeDistanceMeters: number; directDistanceMeters: number; shared: boolean; features: FeatureSums }
interface DriverPlanSet { driverId: string; baseline: FeatureSums; insertions: InsertionPlan[] }
interface RankedInsertion extends InsertionPlan { score: number; recommended: boolean }
function evaluateDriverPlan(input: DriverPlanInput, newcomer: ChoicePassenger, options?: { maxAddedSeconds?: number; maxInitialDetourRatio?: number; dwellSeconds?: number }): DriverPlanSet
function rankDriverOptions(sets: DriverPlanSet[], limit?: number): RankedInsertion[]
```
Root supplies new passenger id `__new__`; driver snapshot includes only confirmed Accepted/PickedUp Choice rides. The matrix must contain driver location, all remaining stops, waiting passengers' pickup/drop-off, and new pickup/drop-off. Validate consistency, positive capacity, no repeated/missing stops, no guessed unreachable legs. Co-located consecutive stop visits incur one dwell; remaining drop-off comparisons use arrival time, pickup ETA arrival excludes its own boarding dwell. No extra seat sales before actual drop-off. Delay increments rounded conservatively to integer seconds with floating epsilon. See exact scoring formulas in spec; normalize every insertion across collection, cheapest per distinct driver. Reuse exported normalizeFeatures and Balanced weights (export WEIGHTS from systemAware.ts without changing legacy algorithm).

### Backend API consumed by UI
- `POST /api/rides/options` authenticated Passenger; body pickupLat,pickupLng,dropLat,dropLng. Response `{ options, pickup:[lat,lng], drop:[lat,lng], routeName, serverTime, attribution }`.
- Each option: `{ optionId, driver:{id,name,phone?,licenseNumber,vehicle:string|null,rating:number|null,reviewCount:number,previouslyRidden:boolean}, pickupEtaSeconds,onboard:number,reserved:number,capacity:number,availableSeats:number,fare:number,shared:boolean,recommended:boolean,reason:string,expiresAt:string,estimateAt:string }`. No other-passenger identities.
- `POST /api/rides/select` body `{optionId}` -> `{ride,expiresAt,serverTime}`. Immutable server quote; no client fare accepted.
- Existing `/rides/accept`, `/decline`, `/complete`, `/cancel` dispatch Choice rides to new service, Legacy unchanged.
- New `POST /api/rides/pickup` driver, `{rideId}` -> `{ride}`.
- Existing passenger current and driver current retain arrays and add `serverTime`. Each Choice ride exposes `plannerMode:'Choice'`, status Requested/Accepted/PickedUp/Completed/Cancelled, quoteShared:boolean, lockedFare:number|null, pickedUpAt, offerExpiresAt:string|null, `plannedStops:Array<{rideId,type,lat,lng,passengerName}>` (confirmed remaining plan for accepted rides; proposed insertion for pending offer). All history/stats remain existing shapes.
- Socket `newRideRequest` preserves PoolOffer shape plus `{expiresAt,serverTime,mode:'Choice'}`. `rideMatched` contains selection/driver/expiry; existing accepted/completed/location/cancelled compatible. New `ridePickedUp` `{rideId}`. Decline/expiry emits `rideUnmatched` `{rideId,reason,returnToChoices:true}` to selected passenger and `requestExpired` to driver, without affecting existing riders. `driverOptionsChanged` `{driverId}` invalidates visible choice list (debounce and preserve active booking).
- Errors `{error:string}`; 400 invalid,403 wrong actor,409 stale/conflict/expired,503 routing unavailable. No synthetic simulation times in successful options.

## Task 1 â€” road routing boundary (delegated, exclusive module/tests)
- [x] Write failing routing tests with synthetic fetch responses for directionality, duplicates, duration/distance validation, timeout, coalescing, cache and queue spacing; run RED.
- [x] Implement RoadRouter/OsrmRouter contracts above; default OSRM endpoint only for light educational demo, accurate attribution policy.
- [x] Run routing tests GREEN; report commands and evidence. No public provider loops; at most one optional smoke request by root.

## Task 2 â€” pure constrained insertion/ranking (delegated, exclusive module/tests plus WEIGHTS export)
- [x] Failing pure tests: 90+30 accepted and 90+31 rejected; onboard passengers no pickup; all feasible insertions; capacity; initial detour; shared overlap; co-located dwell; asymmetric roads; no candidate for unreachable leg; distinct-driver ranking; rating irrelevant. Run RED.
- [x] Implement exact Planner contract and spec formulas; no DB/network.
- [x] Run GREEN and type-check owned files, report edge cases.

## Task 3 â€” additive persistence and choice lifecycle (root)
- [x] Add private local PostgreSQL cluster/database, own path/port only; baseline tests remain green.
- [x] Write failing integration contracts using real local DB + synthetic RoadRouter: four option cards and privacy, select other than recommended, no reservation on browse, last-seat concurrency, one pending per driver/passenger, 30s expiry, stale versions, locked fares, 120s accounting/pickup/no reset, legacy exclusion, cancellation/removal, routing failure. No skipped required integration checks.
- [x] Add schema/migration: PlannerMode Legacy default; Ride PickedUp/lock/delay/raw coordinates/offer fields; Driver version/freshness/remainingStops; Route cached roadGeometry; ChoiceOffer quoted/pending/final states with timestamps/trip/proposal and unique ride relation. Preserve historical records.
- [x] Implement ChoiceService with constructor injection `(db: PrismaClient, router: RoadRouter)`, singleton for actual controllers, options/select/accept/decline/pickup/complete/cancel/expire/read decoration. Lock passenger then driver for selection; driver lock for mutations; network planning outside transactions and CAS versions. SQL locks and unique indexes enforce, not Map state.
- [x] Integrate controllers/routes, legacy matcher isolation and atomic driver recheck, location version updates, history/current status sets and fare use. Guard original Legacy methods and keep all previous tests green.
- [x] GREEN integration suite, fresh migration deployment on owned DB, regenerate Prisma, type checks.

## Task 4 â€” React driver-choice flow (delegated, exclusive frontend files)
- [x] Implement typed cards and comparison display using API contract; selectors/list loading/empty/503/stale/error states, no fabricated options.
- [x] Selection pending countdown from server time, immutable quote display, cancel/decline/expiry refreshes list with passenger choice intact; no silent assignment.
- [x] Upgrade ride recovery to PickedUp, live events and option invalidation without stale response overwrites. Preserve Profile fixes and demo route text.
- [x] Driver: new Pickup action before drop-off for Choice, canonical remaining stop order, pending insertion while active ride continues, 30s offer countdown; location/tracking continues during active ride even when unavailable for additional pickups. Update types and existing bookings/dashboard active-state logic only as needed.
- [x] Browser fixture tests RED/GREEN via existing installed tooling; no new runtime packages or editing backend files. Root provides real end-to-end run after backend integration.

## Task 5 â€” integrate, verify, review and handoff (root)
- [x] Real local PostgreSQL/browser end-to-end: four feasible drivers mixed occupancy, non-top selection, driver accept/pickup/drop-off, fare/history/earnings, decline/expiry, reconnect and 120s constraint; no real SMS/payment.
- [x] Original + new backend tests; root typecheck; frontend build; changed-code lint and full diff review.
- [x] Independent final review, address concrete findings with regressions. Document routing assumptions, local fixtures and migration/deployment steps; never run destructive seed on live data.
- [x] Keep local DB data/credentials outside Git, preserve prior patch, report exact coverage/limits and ready-for-deploy result. Ask separately before publishing.

## Review focus
Late API results/older location snapshots; concurrent last-seat and legacy-vs-choice claim; pickup/drop-off/expiry races; route versions changing during provider calls; quote overlap disappearing; null or implausible road legs; clock skew; duplicate clicks and restarts; stale location; legacy accepted data missing new planner state.

## Decisions / execution ledger
- Native coordination with independent owned-file delegation; no extra method prompt after explicit user go-ahead.
- Existing detached review copy is already isolated from the user's original project; use its feature branch without another worktree.
- Use private native PostgreSQL because Docker is not running; do not start or modify an unrelated existing database/service.
- Fare uses actual road kilometres in the existing base/per-km formula, not road kilometres multiplied by the old geometric 1.3 approximation again.
- Missing-data routing fails closed. Public OSRM is not a batch experiment provider; integration tests inject deterministic road matrices.

- Final verification and limitations are recorded in docs/PASSENGER_CHOICE.md; local-only implementation, no publication.
