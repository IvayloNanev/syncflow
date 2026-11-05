import test from 'node:test';import assert from 'node:assert/strict';
import {explicitTerritoryConflict} from '../agents/review/territory-conflict.js';
const msg=text=>({message_id:'m1',text});
test('explicit unresolved repeated territory and mutually exclusive territory statements are flagged with exact evidence',()=>{
 for(const text of ['Territory: Canada. Territory: United States. No correction has been confirmed.','Territory: Germany only. Territory: France only.']){
  const evidence=explicitTerritoryConflict([msg(text)]);assert.equal(evidence.length,2);for(const e of evidence)assert.ok(text.includes(e.exact_quote));
 }
});
test('compatible territory lists and labels without explicit incompatibility do not become conflicts',()=>{
 for(const text of ['Territories: Canada and United States.','Territory: Canada. Territory: United States.','Territory: Canada only.'])assert.equal(explicitTerritoryConflict([msg(text)]),null);
});
test('explicit later correction supersedes earlier conflict but a new conflict in that correction still blocks',()=>{
 const old=msg('Territory: Canada only. Territory: US only.');
 assert.equal(explicitTerritoryConflict([old,{message_id:'reply',text:'Correction: territory is worldwide.'}]),null);
 assert.ok(explicitTerritoryConflict([old,{message_id:'reply',text:'Corrected territory: UK only. Territory: France only.'}]));
});

test('Review blocks an explicit source contradiction even when Intake omits the ambiguity',async()=>{
 const {readFileSync}=await import('node:fs');const {runReview}=await import('../agents/review/run-review.js');
 const fixture=JSON.parse(readFileSync(new URL('../fixtures/development/complete.json',import.meta.url),'utf8'));
 fixture.context.messages[0].text+=' Territory: Canada. Territory: United States. No correction has been confirmed.';
 const review=runReview(fixture.context,fixture.intake);
 assert.equal(review.ok,true);
 const conflicts=review.output.issues.filter(i=>i.type==='conflict'&&i.field_keys.includes('territories'));
 assert.equal(conflicts.length,1);assert.equal(conflicts[0].evidence.length,2);
});
