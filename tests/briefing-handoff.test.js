import test from 'node:test';
import assert from 'node:assert/strict';
import {briefingHandoff} from '../agents/priority/handoff.js';
const item={request_id:'a',project:'Campaign',client:'Client',reason:'Deadline passed',blocker:'Pending decision',next_action:'Contact reviewer',responsible:'Coordinator',changed:false,evidence:[{kind:'email',text:'Original request'}],handoff:{destination:'coordinator',anchor:'reviewer-follow-up',state:'action'}};
const data={decision_source:'ai',items:[item],saved_at:'2026-11-09',checked_at:'2026-11-09'};
test('handoff carries current recommendation, rank, owner and evidence to its receiving workflow',()=>{const result=briefingHandoff(data,'a','coordinator');assert.equal(result.current,true);assert.equal(result.destination_matches,true);assert.equal(result.rank,1);assert.equal(result.next_action,item.next_action);assert.deepEqual(result.evidence,item.evidence);});
test('stale and changed recommendations never hand old action prose to the receiving page',()=>{for(const d of [{...data,decision_source:'workflow'},{...data,items:[{...item,changed:true}]}]){const result=briefingHandoff(d,'a','coordinator');assert.equal(result.current,false);assert.equal(result.next_action,undefined);assert.equal(result.evidence,undefined);}});
test('foreign request and wrong destinations cannot masquerade as the intended handoff',()=>{assert.equal(briefingHandoff(data,'foreign','coordinator'),null);assert.equal(briefingHandoff(data,'a','internal').destination_matches,false);});
