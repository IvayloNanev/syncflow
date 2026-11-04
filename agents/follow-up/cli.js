import { readFileSync } from 'node:fs';
import { runReview } from '../review/run-review.js';
import { runFollowUp } from './run-follow-up.js';
import { createFollowUpClaudeProvider } from './providers/claude.js';
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--provider' || !['mock','claude'].includes(args[1])) {
  console.error('Usage: node agents/follow-up/cli.js --provider mock|claude'); process.exitCode = 2;
} else {
  try {
    const fixture = JSON.parse(readFileSync(new URL('../../fixtures/development/incomplete.json', import.meta.url), 'utf8'));
    const review = runReview(fixture.context, fixture.intake).output;
    let provider;
    if (args[1] === 'claude') {
      try { process.loadEnvFile('.env'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
      provider = createFollowUpClaudeProvider();
      console.error('LIVE Claude draft call: sends fictional context and review to Anthropic. No email is sent.');
    } else {
      console.error('MOCK template demo only. No model call or email sent.');
      provider = { id: 'mock:review-questions', mode: 'mock', async generate({context,review}) {
        return { schema_version: context.schema_version, run_id: context.run_id, base_record_version: context.base_record_version,
          subject: 'Details needed for your music request',
          body: `Hello,\n\nCould you clarify the following?\n${review.issues.map(i => `- ${i.question}`).join('\n')}\n\nThank you.`,
          addressed_issue_ids: review.issues.map(i => i.issue_id) };
      } };
    }
    const result = await runFollowUp(fixture.context, review, { provider });
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
  } catch { console.error('Unable to draft. Check local configuration; no email or record was changed.'); process.exitCode = 2; }
}
