# ChaloAuto 🛺

Shared auto-rickshaw rides on fixed city routes. Passengers pick a pickup and drop-off on a map, a **System-Aware
pooling algorithm** (from the Python simulation) groups riders heading the same way, and drivers accept pooled
trips in real time with live tracking, fares and ratings.

| Folder | What it is |
|---|---|
| `Backend/` | Express 5 + Prisma + PostgreSQL + Socket.io API, OTP auth, batch matching, fares, ratings |
| `Frontend/` | React 19 + Vite + Tailwind: landing, map booking, live tracking, driver dashboard, simulation page |
| `Simulation/` | Python simulator (Nearest Driver, Greedy Pooling, System-Aware) with results and plots |
| `docs/` | `HOW_IT_WORKS.md` |

## Run locally
```bash
npm run install:all                     # installs Backend + Frontend (Prisma client is generated automatically)
cp Backend/.env.example Backend/.env    # fill in DATABASE_URL and Supabase keys
cp Frontend/.env.example Frontend/.env
cd Backend && npx prisma migrate deploy && npm run seed && cd ..
npm run dev:backend                     # API on :8000
npm run dev:frontend                    # app on :3000
```
Dev test logins (after seeding): passengers `+919999000001`..`05`, drivers `+918888000001`..`05`, OTP `123456`.
Try it with two browsers: passenger requests (e.g. pickup 28.6304,77.2177 to drop 28.5921,77.1659), driver 1 accepts.
On the driver's active-ride panel, tick **Simulate driving** to move the auto without GPS.

## Simulation integration
- The algorithm `system_aware_assignment()` is ported to `Backend/src/algorithms/systemAware.ts` and drives matching.
- `GET /api/simulation/summary` and the `/simulation` page show the experiment results.
- Re-run experiments: `npm run simulate` then `npm run simulate:export`. Details in `Simulation/README.md`.

## Tests
```bash
npm test          # algorithm, fare, geo, token and API auth tests (node:test)
npm run typecheck
```

## Deploy
- **API**: `render.yaml` is a Render blueprint (build runs `prisma migrate deploy`). Set `DATABASE_URL`, Supabase keys,
  `CORS_ORIGIN`, keep `ALLOW_TEST_LOGIN=false`.
- **Frontend**: deploy `Frontend/` to Vercel/Netlify (`vercel.json` handles SPA routing). Set `VITE_API_URL` to the API URL.

## Security notes
No secrets are included in this repo. Keep real keys only in your local `.env` files, and rotate any key that was
previously shared or committed.
