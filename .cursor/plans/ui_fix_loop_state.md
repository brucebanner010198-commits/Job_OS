# UI Fix Loop State

**Loop:** STOPPED — criteria met  
**Last check:** 2026-06-18 (Production Supervisor)

## Stop criteria

| Check | Status |
|-------|--------|
| `curl localhost:3000` shows Job OS dashboard/setup content | ✅ `Three steps`, `Job OS`, `Job search pipeline` |
| `npm run typecheck` | ✅ 0 errors |
| `npm run test:e2e-journey` | ✅ 10/10 |

## Loop schedule

- Interval: 5m (armed during incident)
- **Action:** STOP — all criteria green

## Next loop trigger

Re-arm if user reports blank UI again. First steps:

1. `lsof -ti:3000,3001 | xargs kill -9`
2. `rm -rf .next && npm run dev`
3. Confirm `npm run db:up` if DbBanner shows
