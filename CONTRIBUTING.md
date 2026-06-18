# Contributing to Job OS

Thank you for your interest in Job OS. This project is **source-available** under a custom license — personal and non-commercial use is free; third-party commercial use requires a royalty agreement. See [LICENSE](./LICENSE) and [COMMERCIAL-LICENSE.md](./COMMERCIAL-LICENSE.md).

**No CLA is required** for personal contributions. By contributing, you agree that your contributions are licensed under the same terms as the project, and that third-party commercial use of the codebase remains subject to the commercial restrictions in the LICENSE.

## Getting started

```bash
git clone https://github.com/solomonsjoseph/job-os.git   # adjust to your fork URL
cd job-os
npm ci
cp .env.example .env
npm run db:up
npx prisma migrate deploy
npm run dev
```

See [README.md](./README.md) and [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) for environment variables, LAN security, and `.secrets` setup.

## Development workflow

1. **Fork** the repository (or branch from `main` if you are a maintainer).
2. **Create a focused branch** — one logical change per pull request when possible.
3. **Run quality gates locally** before opening a PR (see below).
4. **Open a pull request** against `main` with a clear description and test plan.

Maintainer review is required. [CODEOWNERS](./.github/CODEOWNERS) routes all changes to `@solomonsjoseph`.

## CI quality gates

GitHub Actions ([`.github/workflows/ci.yml`](./.github/workflows/ci.yml)) runs on every push to `main`/`master` and on pull requests:

| Gate | Command |
|------|---------|
| Database migrate | `npx prisma migrate deploy` |
| Lint | `npm run lint` |
| Dependency audit | `npm audit --audit-level=high` |
| Typecheck | `npm run typecheck` |
| Build | `npm run build` |
| Integration tests | `npm run test:integrations` |
| Invariant / domain tests | 37+ `npm run test:*` scripts (provenance, scoring, apply, security, knowledge, etc.) |

CI uses **Postgres 17 with pgvector** (`pgvector/pgvector:pg17`) as a service container.

Run the full local equivalent before submitting:

```bash
npm run lint
npm run typecheck
npm run build
npm run test:integrations
npm run test:security
# … plus any tests relevant to your change
```

## Commit conventions

Follow [Conventional Commits](https://www.conventionalcommits.org/) style, matching existing history:

| Prefix | Use for |
|--------|---------|
| `feat:` | New feature or capability |
| `fix:` | Bug fix |
| `docs:` | Documentation only |
| `test:` | Tests only |
| `ci:` | CI / workflow changes |
| `chore:` | Maintenance, tooling, release hygiene |
| `refactor:` | Code change that neither fixes a bug nor adds a feature |

**Scope** (optional): `feat(apply):`, `fix(security):`, `ci:` — use when it clarifies the affected area.

Examples from this repository:

```
feat(api): add Zod action validation and integration verify endpoint
fix(security): close read gates and harden backup export
ci: add postgres service, lint, and audit gates
docs: add backend API contracts and deployment guide
```

- One logical change per commit when feasible.
- Write commit messages in the imperative mood ("add", not "added").
- Reference issues in the PR body when applicable.

## What to contribute

- Bug fixes with regression tests
- Documentation improvements
- Test coverage for untested paths
- Performance or security hardening (see [SECURITY.md](./SECURITY.md))

**Out of scope for drive-by PRs:** large refactors, new product features without prior discussion, or changes that weaken local-first security defaults.

## Code style

- **TypeScript** — strict mode; match existing patterns in surrounding files
- **Server actions** — gate reads with `requireAccessForRead()`, mutations with `requireAccessForMutation()`
- **Validation** — use Zod schemas in `lib/validation/` for mutating action inputs
- **Secrets** — never log secret values; never commit `.secrets/` or `.env`

## Dependency updates

Dependabot opens weekly PRs for npm and GitHub Actions. Review and merge when CI is green.

## Questions

- **Usage / deployment:** [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)
- **Commercial licensing:** [COMMERCIAL-LICENSE.md](./COMMERCIAL-LICENSE.md)
- **Security:** [SECURITY.md](./SECURITY.md)
