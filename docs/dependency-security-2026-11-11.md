# Dependency security update — November 11, 2026

The npm advisory audit initially reported 11 advisories (five high, six moderate). After the changes below, `pnpm audit --json` reports zero at all severities. This is a point-in-time dependency advisory check, not a security certification or a live capacity test.

## Changes

| Dependency | Before | After | Scope |
| --- | --- | --- | --- |
| AJV | 8.17.1 | 8.18.0 | Direct schema validator |
| Workflow SDK | 5.4.0 | 5.5.0 | Compatible minor upgrade |
| Workflow Vitest | 5.0.8 | 5.0.9 | Matching integration-test adapter |
| Undici | 7.30.0 | 7.30.2 | Updated upstream Workflow dependencies |
| Zod | 4.1.11 / 4.5.4 | 4.6.7 | Upstream upgrade plus scoped override for remaining v4 consumers |
| Minimatch | 9.0.9 / 10.2.6 | 11.0.7 | Scoped override for affected versions 7–10 |

Workflow 5.5.0 supplies the patched HTTP dependency and updates most Zod consumers. Two advisories remained after this upstream update: an older Zod through Vercel CLI configuration and Minimatch through Queue, SWC CLI, Oclif and lint tooling. `pnpm-workspace.yaml` therefore overrides only `zod@>=4 <4.6.6` and `minimatch@>=7 <11.0.1`. Existing Minimatch 3/5 consumers are unaffected. Remove the overrides when upstream dependencies themselves require patched versions.

Minimatch's patch requires crossing a major version. Its inspected Queue, SWC and Oclif callers use the named `minimatch` export retained in v11, and the project runs Node 24, supported by the patched package. Build, lint, Workflow CLI and compiled runtime checks passed. This does not establish compatibility for every unused framework adapter bundled by Workflow.

pnpm added exact-version release-age exceptions for the reviewed Workflow updates and Minimatch patch. These exceptions do not disable release-age checking globally; frozen installs retain the reviewed lockfile and integrity hashes. Build-script permissions remain unchanged.

## Verification

On Node 24.22.1 and pnpm 11.25.0:

- 367 regression tests and four compiled Workflow runtime tests passed.
- Eight mock HTTP smoke checks passed; no model was called or email sent.
- Three fixture contracts and all 20 frozen evaluation cases passed validation.
- ESLint, TypeScript, the production build and Workflow CLI help passed.
- The final advisory audit reports zero vulnerabilities.

No provider, model, quota, database schema, auth or production configuration was changed by the dependency update. Deployment verification is separate from these local checks.

## Advisory references

- [AJV data-option ReDoS](https://github.com/advisories/GHSA-2g4f-4pwh-qvx6).
- [Zod constrained-collection memory exhaustion](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).
- [Minimatch globparts amplification](https://github.com/advisories/GHSA-g3hv-75wg-m249).
- Undici: [4qv8](https://github.com/advisories/GHSA-4qv8-2p9j-2685), [f72v](https://github.com/advisories/GHSA-f72v-6w45-q472), [xjj6](https://github.com/advisories/GHSA-xjj6-f33q-929c), [4w7w](https://github.com/advisories/GHSA-4w7w-5xrc-9h26), [2m5v](https://github.com/advisories/GHSA-2m5v-pch6-74hx), [qrxm](https://github.com/advisories/GHSA-qrxm-fqhp-jwvm), [9fm3](https://github.com/advisories/GHSA-9fm3-97px-rjf6), [55wc](https://github.com/advisories/GHSA-55wc-3pg8-jfw6).
