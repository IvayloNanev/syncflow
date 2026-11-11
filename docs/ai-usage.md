# Hosted AI usage limits

Every hosted Anthropic request from Coordinator, Daily Brief, and Internal Review reserves usage in PostgreSQL before network delivery. Retries and failed provider attempts count; cached results and idempotent replays without a provider call do not. The reservation checks current workspace membership and serializes concurrent reservations per workspace. Missing budget storage fails closed.

Default limits per UTC calendar day:

| Scope | Model attempts | Serialized input bytes |
| --- | ---: | ---: |
| Workspace | 60 | 2,000,000 |
| Member within workspace | 30 | 1,000,000 |

There is also a six-attempt member/workspace limit per calendar minute. Each request is limited to 256,000 UTF-8 bytes and at most 8,192 output tokens. Agents can impose tighter limits. Daily Brief still supports at most 50 open cases and rejects oversized histories instead of silently omitting them.

These are volume limits, not exact dollar budgets. Provider prices, tokenization, and cache behavior affect actual charges. Set the provider account's spending limit as a second control. Local CLI/evaluation scripts are operator tools and do not use hosted workspace quotas; live evaluation can make up to 40 paid calls.

## Operations

Apply `db/ai-usage.sql` before releasing the server changes. It was applied to the linked SyncFlow Supabase project on November 11, 2026. Both tables have RLS and service-role-only privileges. End users cannot edit limits or counters.

Administrators inspect `syncflow_ai_usage` for daily calls, input bytes, and the last feature. `syncflow_ai_limits` supports per-workspace overrides and an `enabled=false` kill switch. Do not expose the service key to the browser. Counters store no prompts, messages, or model output. Reservations are conservative: cancellation or provider failure after reservation does not refund usage. UTC-day counters remain available for audit; retention cleanup is not automatic.

Verification used isolated temporary database records in a rolled-back transaction. It checked minute, daily-call, byte, and nonmember rejection paths. Automated tests also check denial before network access, fail-closed behavior, cancellation, and per-attempt charging. No client cases changed.
