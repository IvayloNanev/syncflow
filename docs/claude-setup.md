# Claude API setup

The Intake provider now supports a direct Anthropic Messages API call. It is configured separately from a Claude chat subscription, GitHub, or Codex. Model access and billing are managed in your Anthropic developer account.

## 1. Create API access yourself

Open https://platform.claude.com/ and create/sign into your developer account. Set up any required API billing and create a project/workspace API key. Do not paste keys into chat, GitHub, screenshots, or issue comments. No account, billing, key creation, or real model call was performed by this code change.

## 2. Configure local secrets

The local `.env` is ignored by Git. If you do not have one, copy `.env.example` to `.env`. Never overwrite an existing `.env` blindly.

Edit `.env` in your local editor:

```dotenv
ANTHROPIC_API_KEY=your_actual_key_here
ANTHROPIC_MODEL=claude-haiku-5-5
```

The model is an example from the current model documentation, not an access guarantee. Use a supported model enabled for your account. Choose the provider/model before making paid calls. Do not place the key in a browser-exposed environment variable or frontend source. Each collaborator configures their own local credentials; share code, not keys.

Verify ignoring without printing the key:

```sh
git check-ignore .env
```

It should print `.env`. Only `.env.example` with an empty API key is committed.

## 3. Run one fictional live example

```sh
pnpm install --frozen-lockfile
pnpm intake:claude
```

This explicitly selects Claude, loads `.env` locally, sends the fictional incomplete-request context to Anthropic, and may incur API charges. It does not send evaluation answer keys. It prints `LIVE CLAUDE CALL` before making the request. No automatic retries occur. A valid response is a proposal requiring coordinator review, not a confirmed record.

For a different development case:

```sh
node agents/intake/cli.js --provider claude --scenario partial-reply
```

For an app-generated request context:

```sh
node agents/intake/cli.js --provider claude --scenario incomplete --context context.json
```

The context file must contain only the agreed context object. `--scenario` selects a development fallback only when `--context` is absent. Use fictional emails while testing. Returned proposal JSON includes source excerpts, so do not publish output containing private messages.

The script loads `.env` only for the Claude provider; existing shell variables take precedence under Node's environment loader. No test invokes a real API. `pnpm intake:demo` still works without credentials.

## How it works

`createClaudeProvider` implements the same provider port as the mock. It calls the fixed `https://api.anthropic.com/v1/messages` origin with an API-key Bearer header and version `2026-10-21`. The system prompt is versioned in `agents/intake/prompts/intake-v1.txt`. The shared JSON schema is inlined into a single `submit_intake` client tool definition, which is used only to collect structured output; no model-specified tool is ever executed.

The parser accepts exactly one matching tool block and rejects truncation, refusal and other stop reasons. Tool inputs still undergo our local schema, source-quote and record-version validation. Request formatting is verified by fake-transport tests. On November 4, 2026, one fictional incomplete-request call passed local validation after explicitly typing constant fields in the tool schema. Two earlier calls were rejected because schema_version was returned as numeric 1 rather than string "1.0". This is a smoke test, not an accuracy benchmark; the full evaluation and partner review remain outstanding.

## Troubleshooting

- Not configured: add a nonempty key and model to `.env` locally.
- Authentication failed: check your API key, workspace and account access.
- Rate limited: wait and retry explicitly; there is no hidden retry loop.
- Request rejected: check model availability and API request compatibility.
- Invalid output: inspect fictional proposals during development; never bypass validation to accept a malformed response.
- Timeout: original confirmed data remains intact. A longer-running provider is not granted permission to write records.

## References

- Messages API: https://platform.claude.com/docs/en/api/messages/create
- Tool use: https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview
- Model IDs: https://platform.claude.com/docs/en/models/overview

This is the CLI/provider portion of Issue #5, not an authenticated HTTP endpoint. Mosiah's server must scope requests to workspace membership and keep credentials private. A real live call and partner review are still required before claiming Issue #5 complete.
