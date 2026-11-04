import { readFileSync } from 'node:fs';
import { runReview } from './run-review.js';
const fixture = JSON.parse(readFileSync(new URL('../../fixtures/development/incomplete.json', import.meta.url), 'utf8'));
console.error('Development fixture → deterministic Review. No API call or saved changes.');
const result = runReview(fixture.context, fixture.intake);
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;
