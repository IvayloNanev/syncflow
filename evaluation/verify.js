import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { validateFixture } from '../contracts/validate.js';

export const directory = new URL('./held-out/', import.meta.url);
export const manifest = JSON.parse(readFileSync(new URL('./manifest.json', import.meta.url), 'utf8'));
export const checklist = JSON.parse(readFileSync(new URL('../contracts/checklists/intake-v1.json', import.meta.url), 'utf8'));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export function verifyCorpus() {
  if (manifest.cases.length !== 20) throw new Error('Expected exactly 20 held-out cases');
  const listed = manifest.cases.map(c => c.file).sort();
  if (JSON.stringify(listed) !== JSON.stringify(readdirSync(directory).filter(f => f.endsWith('.json')).sort()))
    throw new Error('Manifest and corpus files disagree');
  const checklistBytes = readFileSync(new URL('../contracts/checklists/intake-v1.json', import.meta.url));
  if (digest(checklistBytes) !== manifest.checklist_sha256) throw new Error('Checklist changed without evaluation version update');
  const ids = new Set();
  for (const entry of manifest.cases) {
    const bytes = readFileSync(new URL(entry.file, directory));
    if (digest(bytes) !== entry.sha256) throw new Error(`Frozen answer changed: ${entry.file}`);
    const fixture = JSON.parse(bytes);
    if (ids.has(fixture.case_id)) throw new Error(`Duplicate case: ${fixture.case_id}`);
    ids.add(fixture.case_id);
    validateFixture(fixture);
    // Frozen expected proposals may not change unrelated confirmed fields.
    for (const field of fixture.expected_behavior.must_preserve_fields)
      if (fixture.intake.proposed_changes.some(p => p.field_key === field))
        throw new Error(`${fixture.case_id}: preserved field proposed for change: ${field}`);
    const keys = new Set(checklist.fields.map(f => f.key));
    for (const check of fixture.review.checks)
      if (check.rule_id.startsWith('required:') && !keys.has(check.rule_id.slice(9)))
        throw new Error('Checklist and expected checks disagree');
  }
  return ids.size;
}
