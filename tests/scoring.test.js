import test from 'node:test';import assert from 'node:assert/strict';
import { equivalent,scoreCase,summarize } from '../evaluation/score.js';
test('scorer accepts cosmetic differences but not invented normalized components',()=>{
 assert.ok(equivalent(['Canada','US'],['us',' Canada ']));
 assert.ok(equivalent({supplied_text:'a',currency:null},{supplied_text:'b',currency:null}));
 assert.ok(!equivalent({currency:null},{currency:'USD'}));
 assert.ok(!equivalent('film','movie'));
});
test('scorer counts omissions, extras, wrong facts and typed issue mismatches',()=>{
 const f={intake:{proposed_changes:[{field_key:'artist',proposed_value:'A'},{field_key:'budget',proposed_value:{currency:null}}]},review:{issues:[{type:'conflict',field_keys:['territories']}]},expected_behavior:{must_preserve_fields:['project']}};
 const r={ok:true,stages:{intake:{output:{proposed_changes:[{field_key:'artist',proposed_value:'A'},{field_key:'budget',proposed_value:{currency:'USD'}},{field_key:'project',proposed_value:'invented'}]}},review:{output:{issues:[{type:'ambiguous',field_keys:['territories']}]}},follow_up:{ok:true}}};
 const s=scoreCase(f,r);assert.equal(s.facts.matched,1);assert.equal(s.facts.mismatched.length,1);assert.deepEqual(s.facts.unexpected,['project']);assert.equal(s.issue_signatures.matched,0);assert.equal(s.issue_fields.matched,1);assert.deepEqual(s.preservation_violations,['project']);assert.equal(summarize([{score:s}]).facts.precision,1/3);
});
test('issue severity is part of the match, not just type and fields',()=>{
 const f={intake:{proposed_changes:[]},review:{issues:[{severity:'blocking',type:'missing',field_keys:['project']}]}};
 const r={ok:true,stages:{intake:{output:{proposed_changes:[]}},review:{output:{issues:[{severity:'advisory',type:'missing',field_keys:['project']}]}}}};
 assert.equal(scoreCase(f,r).issue_signatures.matched,0);
});
