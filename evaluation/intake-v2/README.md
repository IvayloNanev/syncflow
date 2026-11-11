# Intake v2 — frozen synthetic verification

Twelve newly authored cases and their expected fields were frozen before the first call. These are not copies of the v1 corpus. They cover full email/brief formats, different licensing uses, partial budget/deadline data, unspecified channels, decimal music length and money, explicit corrections, and prior confirmed territory values.

`cases.sha256` binds the exact inputs and answer key. Only `context` is sent to Intake; expected values remain in the scorer. Do not tune against these results or edit this key to improve scores. Future tuning requires separate development cases and a new verification version. Partner answer-key review remains pending, so this is not independently adjudicated acceptance.

Run explicitly (up to twelve paid calls, sequential, no retries):

```sh
node evaluation/development/run-intake-reliability.js evaluation/results/intake-v2-new-run.json v2
```

The runner checks corpus integrity and context validity before network access and stops on a provider configuration rejection. It records model, prompt hash, tool schema hash, transport version, per-case outputs, conservative value matches, and schema/evidence validation outcomes. Failed cases remain in the denominator. The answer key and scoring equivalences are not altered to fit a response.

This set measures Intake only. It does not establish follow-up prose quality, all blocking-issue performance, rights clearance, human time savings, or production load capacity. Separate development probes exercise incompatible territory, multiple recordings, and prompt injection.
