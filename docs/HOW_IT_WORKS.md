# How ChaloAuto works

## Ride lifecycle
1. **Request** - the passenger picks a pickup and drop-off on the map. The backend snaps both onto the same route
   (within 1 km of the route line) and stores a `Requested` ride with an estimated fare.
2. **Batch matching** - every few seconds (and ~1.5 s after a new request) `matching.service.ts` collects waiting rides
   per route and runs `systemAwareAssignment()` over the idle online drivers of that route.
   The algorithm builds many complete candidate assignments, scores each one on pickup wait, route distance, detour,
   vehicles used and unassigned passengers, and picks the cheapest. Passengers heading the same way end up in one auto.
3. **Offer** - each pool is offered to its driver (`newRideRequest` over Socket.io) with the best stop order.
   Passengers get `rideMatched`. A driver who rejects or ignores the offer (60 s) releases the pool back into the batch.
4. **Accept** - the driver accepts the whole pool; passengers get `rideAccepted` and see the auto live on the map
   (`driverLocationUpdate`).
5. **Complete** - the driver marks each drop-off. The fare is final (pooled rides get 25% off) and the passenger
   can rate the ride.
6. Requests nobody can serve within `MAX_WAIT_MINUTES` are cancelled automatically (simulator `max_wait`).

## Fare
`BASE_FARE 30 + 11/km after 1.5 km`, distance = straight line x 1.3, 25% discount when shared. See `Backend/src/lib/fare.ts`.

## Auth
Supabase phone OTP. In development, numbers containing `99990000` or `88880000` accept OTP `123456` and get a signed
test token. Set `ALLOW_TEST_LOGIN=false` and a strong `JWT_SECRET` in production.
Sockets authenticate with the same token and are placed in the user's (and driver's) rooms automatically.

## Known limits
- The matcher runs inside one server process; scale out only after moving it to a job queue or adding a DB lock.
- A driver who already has an accepted pool does not receive extra passengers (same as the simulator, which assigns
  complete pools to idle drivers).
- Fares are collected in cash; there is no payment integration.
