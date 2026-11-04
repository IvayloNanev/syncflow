/** Template-only mock: formats supplied issues; never interprets a client email. */
export function createFollowUpMockProvider() {
  return { id: 'mock:review-questions', mode: 'mock', async generate({ context, review, signal }) {
    signal.throwIfAborted();
    const issues = [...new Map([...context.unresolved_issues, ...review.issues].map(i => [i.issue_id, i])).values()];
    return { schema_version: context.schema_version, run_id: context.run_id, base_record_version: context.base_record_version,
      subject: 'Details needed for your music request',
      body: `Hello,\n\nCould you clarify the following?\n${issues.map(i => `- ${i.question}`).join('\n')}\n\nThank you.`,
      addressed_issue_ids: issues.map(i => i.issue_id) };
  } };
}
