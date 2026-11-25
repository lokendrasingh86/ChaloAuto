# Passenger choice with System-Aware recommendations

Status: approved by the user in chat on 25 November 2026 for local implementation. Publication and live migrations remain a separate decision.

## Intent and scope

Extend ChaloAuto's existing CP–IGI demonstration so a passenger chooses among up to four feasible drivers, including occupied autos willing to accept another passenger. System-Aware recommends the first option, while the passenger decides which visible trade-offs suit the trip. Preserve the existing application stack, demonstration corridor and prior reliability repairs. No claim of globally novel research, global optimality, live traffic accuracy, legal vehicle access or production readiness is made.

## Decisions agreed with the user

- A single system-ranked list; no passenger preference questionnaire or personalized ranking in this version.
- Four card metrics: estimated pickup time, occupancy/available seats, quoted fare, and driver rating with review count. Fewer than four eligible drivers means fewer cards, never fabricated options.
- A familiar-driver badge means this passenger previously completed a ride with this driver. Rating and familiarity are informational, not ranking inputs. New drivers show “New driver”, not a fabricated rating.
- An occupied auto may appear if the driver accepts more passengers, space remains, and inserting the trip respects route and existing-passenger constraints.
- Every confirmed passenger has a hard cumulative limit of 120 seconds of extra planned delay from later bookings. This is not 120 seconds per added rider, and it is not a real-traffic arrival guarantee.
- Browsing reserves nothing. Selecting one driver temporarily reserves one seat. One pending offer per driver; one pending/active ride per passenger.
- The selected driver has 30 seconds to accept or decline. On rejection or expiry, release the hold and refresh choices; no silent automatic reassignment.
- Hold the displayed quote during that response window. Driver acceptance locks the fare. Later joiners or cancellations do not change an accepted passenger's fare.
- Driver actions distinguish Accepted (reserved seat), Picked up (onboard), and Dropped off (completed).
- Use road-based estimates without live traffic for both pickup ETA and delay feasibility.
- No new features beyond this agreed workflow; no push, merge, live migration or Render change without a separate publication decision.

## Approaches considered

1. **Keep automatic batch assignment and add a driver picker only:** rejected because the existing matcher excludes busy drivers and cannot safely honor a passenger's selection after an occupied vehicle moves.
2. **Keep simulated/geometric travel times:** discussed and not selected; the user agreed to road-based estimates without live traffic.
3. **Selected approach: constrained insertion into remaining routes, ranked by an adaptation of the existing System-Aware objective.** Reuse the existing feature vocabulary and Balanced weights; retain the Python research simulator unchanged. This adds genuine passenger choice without pretending the current idle-only assignment function already handles occupied vehicles.

## Proposed engineering defaults (builder decisions, not user quotes)

### Road routing and estimates

- Introduce a server-side routing interface returning directed road distance, duration, snapped coordinates and model timestamp. Keep units explicit: seconds and metres at the provider boundary, kilometres in existing distance-based scoring.
- For a low-volume educational demo, use an OSRM-compatible endpoint configured through environment, with bounded caching and request coalescing. The public OSRM demo is acceptable only within its non-commercial, light-use policy: global maximum one request per second, no scraping/heavy use, correct attribution and user agent, and no availability guarantees. Do not run simulation experiments or load tests against it. A private compatible endpoint can be configured later without changing the planner.
- Obtain one directed distance/time matrix per relevant driver state rather than making a request for every insertion ordering. Score insertions locally. Use a bounded candidate-driver scan and an overall request timeout; do not claim the returned four are globally best across an arbitrarily large fleet.
- Cache road durations for five minutes and mark their estimate timestamp; there is no live traffic feed. Reject missing/unreachable matrix legs, excessive road snapping (initial threshold 25 m), or routing failures. Do not silently substitute straight-line timing and still claim road-based feasibility. A provider failure returns a retryable unavailable state, not a false “no drivers” conclusion.
- Card pickup ETA includes the driver's remaining stops before the pickup. Road timings use the same model as the 120-second feasibility comparison. A generic driving profile is an approximation, not an auto-rickshaw-specific calibration or confirmation of road access.
- Proposed stop service time: 30 seconds per physical boarding/alighting stop visit, consolidating co-located events. Include it in both plans and any additional delay. Document this as a model assumption to vary in experiments, not observed data.
- Driver position freshness must be tracked separately from online status. Proposed eligibility threshold is 60 seconds for the first demo. Drivers whose positions are unavailable/stale do not get a selectable ETA. Demo movement is explicitly identified as simulated; do not update an old coordinate's timestamp as if it were a fresh GPS fix.
- In this new flow, road snapping happens before corridor validation. Do not project the requested location onto the existing sparse straight-line RoutePoint polyline. Validate the road-snapped location against a stored road geometry for the configured CP–IGI corridor (the existing 1 km corridor service buffer); the actual pickup/drop-off is the road-snapped coordinate shown on the map and option response. Require the passenger to choose another point when road snapping exceeds 25 m, rather than silently introducing a walking pickup feature. Preserve raw coordinates for diagnostics and show any accepted map-matching correction before selection. The legacy endpoint retains its existing coordinate semantics.

### Driver availability and occupancy

- Reuse the existing driver availability control as willingness to accept another request. Turning it off stops new offers but does not cancel accepted rides or stop tracking the current journey.
- Onboard count comes from Picked up rides; reserved count comes from accepted pickups and the unexpired selected-seat hold. A card distinguishes onboard and reserved counts instead of calling every accepted passenger onboard.
- Conservatively require onboard + reserved + held seats to remain within capacity at every commit. Do not pre-sell a seat merely because someone is expected to get off later.
- Showing cards does not lock any driver. A stale option is removed/refreshed after revalidation; do not send the passenger to a different driver automatically.

### Remaining routes and the cumulative delay rule

- Persist the confirmed remaining stop sequence, rather than reconstructing it from separate pickup and drop-off indices. Existing stop order remains fixed; enumerate positions for the new pickup before its new drop-off. Onboard passengers have only a remaining drop-off. Capacity and the current supported-route requirements remain mandatory.
- Protect every already-confirmed passenger, including accepted passengers still awaiting pickup, against additional bookings. This extends the user's onboard protection conservatively to all existing commitments.
- At acceptance, calculate each existing passenger's remaining drop-off time under the current plan and the proposed inserted plan, from the same current vehicle position, same time model and same remaining-stop assumptions.
- Charge `max(0, proposedRemainingSeconds - currentRemainingSeconds)` to that passenger's persisted consumed-delay budget. Commit only if the sum never exceeds 120 seconds. The new passenger starts with zero consumed budget relative to the plan they accept.
- Budget consumption is monotonic and survives pickup, refresh, restart, cancellation of someone else and later insertions. A faster later plan does not silently grant another fresh budget. This conservative accounting may reject some otherwise feasible insertions; document that trade-off.
- Reserve the proposed budget increments during the 30-second pending offer so no other commitment can consume them. Recompute on driver acceptance against the actual current route/location and all remaining holds. Release provisional consumption on decline, expiry or passenger cancellation; only acceptance makes increments permanent.
- Existing travel progress is not itself additional pooling delay. Road delays or a late passenger do not renew the allowance, and the application must not describe the cap as a guarantee against traffic.
- The newly joining passenger also retains the existing default 50% initial distance-detour ceiling: planned distance onboard from their pickup to drop-off must be at most 1.5 times the direct road-route distance between those same snapped endpoints (or the explicitly configured existing detour ratio). Their later 120-second allowance starts only after that initial feasible plan is accepted. Reject zero/unreachable direct trips, preserving the existing minimum-trip requirement. This is not permission to start a new passenger on an arbitrarily indirect trip.

### System-Aware ranking

- Enumerate all feasible pickup-before-drop-off insertions into each scanned driver's fixed remaining stop order. Do not pick a shortest-distance insertion first and call it the System-Aware optimum. Evaluate the resulting fleet snapshot for every feasible insertion, keeping other drivers' committed work fixed across candidates.
- Let R be the fixed set of unfinished confirmed choice-mode passengers plus the new request, and N = |R|. Across every candidate: pickup burden is the sum of the remaining planned road distance from each vehicle's current position to each not-yet-boarded passenger's pickup, divided by N; route distance is the sum of all remaining vehicle-plan road distances; vehicles is the number of drivers with remaining work. These definitions exclude past travel and do not count an onboard rider's already completed pickup again.
- For a waiting/new passenger, their detour term is max(0, (planned pickup-to-drop-off distance - direct pickup-to-drop-off road distance) / direct distance). For an onboard passenger, it is the analogous *remaining* distance ratio from the current vehicle position to their drop-off. Average those terms over N; a zero direct remaining distance is feasible only with zero remaining travel distance. This is explicitly a remaining-work adaptation, not the original simulator's whole-trip detour measurement.
- Reuse Balanced weights: pickup burden 0.30, route distance 0.25, detour 0.25 and vehicle usage 0.20, plus 2.0 times the existing normalized unassigned-demand ratio. Min–max normalize each feature once across the whole feasible insertion collection. Choose the cheapest insertion per distinct driver, then rank drivers and return up to four. Break exact ties deterministically by driver ID and insertion order. The unassigned ratio is constant zero for these feasible new-request candidates; do not invent its effect on ranking.
- Pickup burden remains a road-distance proxy, not observed waiting time. Road ETA is separately displayed and used for the time constraint. Vehicle usage distinguishes activating an empty vehicle from inserting into an already active one. Fixed other-driver work remains in each snapshot so it does not disappear selectively. Preserve all these definitions in documentation/tests rather than calling the idle-only helper unchanged.
- Show “Recommended” on the lowest-cost option. Give a factual explanation from the score components/constraints, not an LLM-generated unverified justification. Do not promise that the recommendation minimizes pickup ETA or is globally optimal.

### Selection, quote and driver response

- Listing returns expiring, server-issued option identifiers bound to the authenticated passenger, trip, driver, quote and route-state version. Clients cannot submit their own authoritative fare, driver occupancy or feasibility result.
- Proposed card quote validity: 30 seconds. Selecting an expired card refreshes the choices before creating a hold; choosing a valid card honors its quoted amount for the driver's 30-second response window, even if occupancy changes while the driver decides.
- Preserve the existing fare formula and programmed shared discount. A shared quote requires a positive-distance planned onboard overlap with at least one already-confirmed passenger in the displayed insertion plan. Merely using an auto whose last passenger will get off before this pickup does not justify a shared quote. Do not speculate about future riders to advertise a discount. An accepted shared quote is still honored if that co-rider later cancels. Do not introduce surge pricing or a payment gateway.
- Selection revalidates route, location, capacity, passenger ownership and availability, then atomically creates one pending request/seat hold and a server-side expiration timestamp. The response window begins when the offer is committed and emitted, not while routing computations are queued.
- Repeated submission of the same selection is idempotent. Different simultaneous selections by one passenger cannot produce multiple active requests. A second passenger cannot acquire the same last seat.
- The driver sees the proposed pickup/drop-off, the offer countdown and the resulting route. Continuing the existing trip requires no acceptance of this new request. Decline/expiry must not detach or cancel anyone already confirmed.
- Acceptance refreshes route feasibility outside the database transaction, then uses a short serializable/locked transaction checking the captured driver route/location versions and server expiry. If those inputs changed, retry planning within a bounded limit or reject as no longer feasible; never hold a transaction open during a network routing call.
- Acceptance commits the stop plan, budgets, seat reservation, locked fare and accepted state together. Only then emit confirmation. Explicit decline/expiry releases provisional state and returns the passenger to refreshed options.
- Pending quote/seat/expiry state is persisted, not solely in an in-memory Map or browser timer. Enforce expiry on reads and mutations as well as through cleanup, so a restart cannot leave permanent reservations.

### Ride lifecycle and cancellation

- Allowed principal transitions: Requested/pending offer -> Accepted -> Picked up -> Completed; Requested or Accepted -> Cancelled. Only the assigned driver can pick up or drop off; only authorized participants can cancel according to state.
- Dropped off requires a prior Picked up event in this new flow. Pickup consumes an accepted reservation and increases onboard count without consuming a second seat. Drop-off frees that seat exactly once.
- Passenger self-cancellation is available before pickup. After boarding, passenger cannot release a physical seat by cancelling in the app; the driver ends the ride by recording the actual drop-off. No new refund/early-termination pricing policy is introduced; locked fare remains the demo rule.
- Completion uses the accepted locked fare instead of recalculating it from the pool size at drop-off. Preserve the quote and whether sharing applied for history and earnings.
- Live updates cover option invalidation, request/offer state, pickup, location, completion and expiry. Browser reload/reconnect recovers canonical state and server-derived countdowns. Do not expose fellow passengers' names or phone numbers on public driver cards.

## Architecture boundaries

- **Backend:** routing adapter/cache; constrained insertion and System-Aware scoring adapter; options/selection/offer lifecycle; database invariants; existing Socket.IO delivery and authentication.
- **Database:** add pickup and quote/lock fields, durable option/offer expiry, driver route version/location freshness, persisted stop plan and per-passenger delay accounting. Exact table decomposition/index names are left to the implementation plan. Migrations are additive and preserve existing history; no destructive reseeding.
- **Frontend:** existing Find Rides gains driver cards and selection/response states; Driver Dashboard gains the approved Picked up action and pending insertion offer; existing map/history/earnings reflect canonical states.
- **Legacy compatibility:** retain the existing automatic request endpoint and research algorithm for existing clients/tests. Mark planner mode explicitly, defaulting pre-migration records to Legacy. Choice drivers with any unfinished legacy request/ride are excluded until that work finishes; do not guess boarding state, delay baselines or historical quote locks during migration. Conversely, any unfinished choice request/ride makes that driver unavailable to legacy batch assignment. Manually selected requests are excluded from the legacy matcher. Only one planner owns an active driver's schedule. The upgraded UI uses the new passenger-choice path.
- **Demo data:** local/test-only fixtures provide four eligible drivers on CP–IGI, mixed occupancy, a familiar driver and an unrated driver. Existing live data is not automatically modified to manufacture four choices. Production fixture changes require approval.

## Acceptance and evidence

1. Eligible idle and occupied autos appear, up to four; full, unavailable, stale, incompatible or over-budget vehicles do not.
2. The same explicit System-Aware scoring orders the cards; rating/familiarity do not secretly modify that order.
3. Every metric is derived from server records/road estimates; “New driver” and previously completed-rides badge are correct.
4. Demonstrate two additions of 90 s and 31 s: the second is rejected; 90 s + 30 s is allowed. Budgets do not reset after refresh, pickup, restart or cancellation.
5. No overbooking, duplicate active passenger request, stale acceptance, or completion/expiry race under controlled PostgreSQL integration tests.
6. A declined/expired request changes no existing confirmed ride or fare and reserves nothing afterwards.
7. Quote survives the response window and acceptance; a later cancellation/joiner cannot change the accepted fare.
8. Picked up/drop-off update occupancy exactly once. Tracking continues when a driver stops accepting more passengers.
9. A location/route change during listing, selection or driver decision is revalidated. A routing outage does not fall back to a fake feasible estimate.
10. Local browser end-to-end tests demonstrate selection of a non-recommended driver, acceptance/pickup/drop-off, reconnect recovery, expiry and race handling. Routing is stubbed for deterministic tests; a small explicit provider smoke check verifies integration separately, never a load test.
11. Existing reliability tests, type checks and production build pass. No new code or live change is authorized until this design is approved.

## Non-goals

No live traffic feed, driver verification, payment integration, personalized scoring, learning-to-rank, new walking pickup mode, global fleet optimization, expanded service area, research-result replacement, publication or production migration in this design step. These require separate discussion.

## Sources checked for the routing proposal

- OSRM API: https://project-osrm.org/docs/v5.24.0/api/
- Official public demo policy: https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server
- Hosting operator policy: https://routing.openstreetmap.de/about.html

The provider choice, cache/freshness/stop-time defaults and exact database/API structure above are proposed engineering decisions. The user agreed to road-based estimates without traffic, not to those particular numerical defaults or a provider-specific guarantee.
