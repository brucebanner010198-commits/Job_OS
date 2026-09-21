# Production readiness review

This document details the Production Readiness Review (PRR) for Job OS. It applies the Site Reliability Engineering (SRE) production standards documented in Google's SRE framework.

## 1. System architecture and failure isolation

### Boundaries and blast radius
- Job OS runs as a local-first application with optional local area network exposure.
- External dependencies (Ollama, OpenRouter, Google Gemini, OpenAI, Anthropic, live job boards) are isolated behind resilient client boundaries.
- Database access is managed through a pooled PostgreSQL adapter with lazy initialization. If the database is offline, pages can render in degraded mode without crashing the process.

### Timeout budgets (RPC deadlines)
- Every external network call enforces a client-side deadline to prevent cascading hangs.
- AI completions (`chatOllama`, `chatOpenRouter`, `chatOpenAI`, `chatGemini`, `chatAnthropic`) apply a default 45-second deadline via `AbortSignal`.
- Vector embeddings (`embedText`) enforce a 15-second deadline.
- Web research (`safeFetch`) enforces a 12-second abort signal and a 50 KB body size cap.
- Database health pings enforce a 3-second deadline to avoid blocking probes during database degradation.

## 2. Observability and the four golden signals

### Latency
- `/api/health` records database round-trip latency (`latencyMs`) on each health evaluation.
- Local reachability cache has a 5-second TTL to balance freshness with query load.

### Traffic
- Proxy gate logs incoming requests and enforces LAN rate limits.

### Errors
- Structured JSON logging (`lib/observability/logger.ts`) emits structured entries with ISO timestamps, severity level, domain, and error fields.
- Process-level listeners capture `uncaughtException` and `unhandledRejection` to log error diagnostics before an exit.

### Saturation
- PostgreSQL connection pool enforces an upper bound (`DB_POOL_MAX`, default 20) with a 30-second idle timeout and a 5-second connection acquisition timeout.
- Unhandled `error` events on idle pool clients are caught with a listener to prevent database restarts from crashing the Node.js process.

### Health checking (liveness and readiness)
- **Liveness probe** (`/api/health?probe=liveness`): Confirms that the Node.js process is active, event loop is responsive, and reports uptime without hitting downstream dependencies.
- **Readiness probe** (`/api/health` or `/api/health?probe=readiness`): Evaluates database reachability and integration configuration to confirm the instance is ready to receive requests.

### Log sanitization
- The logger automatically inspects fields and redacts values whose keys match sensitive terms (such as `token`, `secret`, `password`, `authorization`, `cookie`, `key`, or `credential`). Secrets and tokens never appear in stdout logs.

## 3. Graceful lifecycle management

### Termination signals
- The process registers listeners for `SIGTERM` and `SIGINT` in `instrumentation.ts`.
- Upon receiving a termination signal, the service initiates a graceful shutdown sequence:
  1. Closes the PostgreSQL connection pool.
  2. Disconnects Prisma client sessions.
  3. Uses a 5-second fallback timeout so hung operations cannot keep the process alive indefinitely.
  4. Exits with status code 0.

## 4. Security and access control (zero trust)

### Network access
- Loopback requests (`localhost`, `127.0.0.1`) bypass the proxy gate for frictionless developer access.
- Non-loopback (LAN) requests to protected paths (`/api/gmail/*`, `/api/backup/*`, `/api/profile/*`) require a valid bearer token or HTTP-only session cookie.
- Server actions run `requireAccessForMutation()` or `requireAccessForRead()` to verify access headers and reject unauthorized requests on non-loopback hosts.

### SSRF and prompt injection protection
- `safeFetch` verifies target URLs through `isPublicHttpUrl`, blocking loopback addresses, RFC1918 private subnets, cloud metadata endpoints, and non-HTTP schemes (`file://`, `javascript://`).
- Untrusted text from job postings is stripped of XML role delimiters and fenced before reaching language models.

## 5. Emergency response and recovery

### Database recovery
- If PostgreSQL restarts or disconnects, the pool error listener absorbs the socket errors while the reachability cache marks health degraded.
- Once PostgreSQL resumes accepting connections, subsequent queries reconnect automatically without requiring a process restart.

### Data protection
- Database backups can be initiated through `npm run backup` or automated daily launchd tasks.
- Encrypted snapshot bundles preserve verified profile facts and application tracking history.

## 6. Verification and test suite

The production readiness posture is verified through automated test suites:
- `npm run typecheck`: Strict TypeScript validation.
- `npm run lint`: ESLint validation on all application routes, actions, and utilities.
- `npm run test:security`: 46 regression tests covering access gates, proxy evaluation, SSRF protection, prompt sanitization, and rate limiting.
