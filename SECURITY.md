# Security Policy

Job OS is a **local-first, single-user** job-search operating system. It is designed to run on your machine — not as a multi-tenant cloud SaaS. This document summarizes the threat model, supported deployment assumptions, and how to report vulnerabilities.

## Supported deployment model

| Environment | Trust assumption |
|-------------|------------------|
| **Loopback** (`localhost`, `127.0.0.1`, `::1`) | Trusted — no bearer token required |
| **Home / office LAN** (`0.0.0.0` bind) | **Requires `JOB_OS_ACCESS_TOKEN`** — shared bearer for API + server actions |
| **Internet-facing** | **Not supported** — no OIDC, RBAC, or CSRF on server actions |

## Threat model summary

### Assets

- **Integration secrets** — API keys in `.secrets/keys.json`, Gmail OAuth tokens, backup encryption key
- **Profile data** — resumes, applications, interview notes, knowledge chunks
- **Automation profile** — Playwright Chrome user data under `.secrets/apply-chrome-profile/`

### Primary threats

| Threat | Mitigation |
|--------|------------|
| **LAN exposure without auth** | Set `JOB_OS_ACCESS_TOKEN`; present via `Authorization: Bearer`, `x-job-os-token`, or `job_os_access` cookie |
| **Secret exfiltration via server actions** | Mutating server actions require `requireAccessForMutation()` on non-loopback |
| **Backup export leak on LAN** | `/api/backup/export` default-deny off loopback unless token configured and presented |
| **SSRF via brief / web research** | `isPublicHttpUrl` + `safeFetch` block loopback, RFC1918, metadata URLs |
| **Playwright navigation to internal URLs** | URL guard rejects non-public schemes before `page.goto` |
| **Missing Host header auth bypass** | Null/missing `Host` is not treated as localhost |
| **Timing attacks on token comparison** | `timingSafeEqual` in `verifyAccessToken` |
| **Rate abuse on LAN** | In-memory limit: 100 req/min/IP on protected API prefixes |
| **LLM prompt injection via job descriptions** | Delimiter stripping and structural hardening in LLM prompts |
| **Plaintext secrets at rest** | `.secrets/` mode `0600`/`0700`; use FileVault; exclude from cloud sync |
| **Token leakage via query string** | `?token=` deprecated — use Bearer header or cookie |

### Residual risks (accepted for local-first design)

- **Shared bearer token** — appropriate for trusted LAN devices only, not internet deployment
- **No CSRF tokens on server actions** — single-user local-first by design
- **Gmail OAuth static state** — low impact in single-user context; signed state planned
- **Gmail push webhook** — shared secret only; optional Pub/Sub OIDC when `GMAIL_PUSH_VERIFY_OIDC=1`
- **Multi-profile isolation** — scoped via `AppScope` + `profileId`; report cross-profile leaks promptly

## `.secrets` hygiene

All sensitive local state lives under `.secrets/` (gitignored):

| Path | Contents |
|------|----------|
| `.secrets/keys.json` | Integration API keys |
| `.secrets/gmail-{profileId}.json` | Gmail OAuth tokens |
| `.secrets/backup.key` | AES-256 backup encryption key |
| `.secrets/apply-chrome-profile/` | Playwright automation profile |

**Do not** commit `.secrets/`. **Do not** sync `.secrets/` to iCloud, Dropbox, or unencrypted backups. Enable **FileVault** on macOS.

Resolution order: Integrations portal → `.secrets/keys.json` → `.env` fallback. Status APIs return `configured: true/false` only — never secret values.

## Reporting a vulnerability

**Please do not open public GitHub issues for security vulnerabilities.**

Email **brucebanner010198@gmail.com** with:

1. Description of the issue and affected component
2. Steps to reproduce (or proof-of-concept)
3. Impact assessment (confidentiality, integrity, availability)
4. Your contact information for follow-up

We aim to acknowledge reports within **5 business days**. Coordinated disclosure is appreciated.

## Security testing

Run the security test suite locally:

```bash
npm run test:security
```

CI runs `test:security` plus `npm audit --audit-level=high` on every push and pull request. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full CI gate list.

## Additional documentation

- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) — LAN hardening, env checklist, backup security
- [LICENSE](./LICENSE) — usage terms (personal free; third-party commercial requires agreement)
