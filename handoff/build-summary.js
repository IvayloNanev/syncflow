const fields = [
  ['client_contact','Client / contact'], ['project','Project'], ['artist','Artist'],
  ['track_title','Track title'], ['recording_version','Recording version'], ['intended_use','Intended use'],
  ['platforms','Media / platforms'], ['territories','Territory'], ['campaign_term','Campaign term'],
  ['music_length','Amount of music'], ['budget','Budget / currency / scope'], ['response_deadline','Response deadline'],
];
function display(value) {
  if (value == null) return 'Not confirmed';
  if (Array.isArray(value)) return value.map(display).join(', ');
  if (typeof value === 'object') return Object.entries(value).filter(([,v]) => v != null).map(([k,v]) => `${k.replaceAll('_',' ')}: ${display(v)}`).join(' · ');
  return String(value);
}
// A deterministic internal report, not another model inference or an approval decision.
/** @param {{request: import("../components/saved-requests").SavedRequest, questions?: {question: string}[], catalog?: {recording: {title: string, artist: string, version: string, id: string} | null, blockers: {question: string}[]}, analysisCurrent: boolean, pendingCount?: number}} input */
export function buildHandoffSummary({request, questions = [], catalog, analysisCurrent, pendingCount = 0}) {
  const confirmed = request.confirmed_fields.filter(f => f.state === 'confirmed');
  const lines = ['INTERNAL SYNC REQUEST HANDOFF — FOR HUMAN REVIEW',
    `Request: ${request.id} · revision ${request.revision}`,
    `Source messages: ${request.messages.length}`, '',
    'REVIEW STATUS',
    `${confirmed.length} confirmed facts; ${pendingCount} proposals awaiting review.`,
    analysisCurrent ? 'Checklist reflects the current saved analysis.' : 'Checklist is unavailable or outdated. Re-analyze before relying on completeness.',
    'This summary is not a licence, clearance, reviewer approval or permission to use music.', '',
    'CONFIRMED CLIENT REQUIREMENTS'];
  for (const [key,label] of fields) {
    const fact = confirmed.find(f => f.field_key === key);
    lines.push(`${label}: ${fact ? display(fact.value) : 'Not confirmed'}`);
    if (fact) {
      lines.push(`  Confirmed by ${fact.confirmed_by || 'unknown'} at ${fact.confirmed_at || 'unknown'}`);
      for (const evidence of fact.evidence || []) lines.push(`  Source ${evidence.message_id}: ${evidence.exact_quote}`);
    }
  }
  lines.push('', 'OPEN CLIENT QUESTIONS');
  if (!analysisCurrent) lines.push('Unknown until current analysis is available.');
  else if (questions.length) questions.forEach(q => lines.push(`- ${q.question}`));
  else lines.push('No current client questions flagged. Human fact confirmation may still be required.');
  lines.push('', 'INTERNAL RECORDING / RIGHTS CHECKS', 'Catalog metadata below is fictional prototype data, separate from confirmed client requirements.');
  lines.push(catalog?.recording ? `Linked recording: ${catalog.recording.title} — ${catalog.recording.artist} · ${catalog.recording.version} · ${catalog.recording.id}` : 'Recording identity unresolved.');
  for (const blocker of catalog?.blockers || []) lines.push(`- ${blocker.question}`);
  lines.push('', 'NEXT INTERNAL ACTION', 'Review unconfirmed fields, verify recording identity and ownership, and resolve outstanding checks before progressing through the licensing process.',
    'Reviewer assignment and approval tracking are not recorded by this summary.', '',
    'Prepared for manual review and sharing. Nothing has been sent automatically.');
  return lines.join('\n');
}
