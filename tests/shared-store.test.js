import test from 'node:test';
import assert from 'node:assert/strict';
import {openSharedStore,creationId} from '../requests/shared-store.js';
function database(){
 const rows=new Map(),members=new Set(['team:alice','team:bob']);
 return {
  rows,
  from(){let workspace,id;return {select(){return this;},eq(key,value){if(key==='workspace_id')workspace=value;if(key==='id')id=value;return this;},async maybeSingle(){return {data:structuredClone(rows.get(`${workspace}:${id}`)??null)};},async single(){return this.maybeSingle();}};},
  async rpc(name,p){assert.equal(name,'syncflow_commit_request');if(!members.has(`${p.p_workspace}:${p.p_actor}`))return {error:{message:'WORKSPACE_ACCESS_DENIED'}};
   const key=`${p.p_workspace}:${p.p_id}`,row=rows.get(key);if((row?.version??0)!==p.p_expected)return {error:{message:'STORAGE_CONFLICT'}};
   const version=p.p_expected+1;rows.set(key,structuredClone({version,state:p.p_state,dashboard:p.p_dashboard}));return {data:version};
  }
 };
}
const create=(store,actor='alice',email='Original email')=>store.create({actor_id:actor,idempotency_key:'create-one',email,timezone:'America/Toronto'});
test('shared requests survive reopen, retain real audit actor, and are editable by another member',async()=>{
 const client=database(),id=creationId('team','alice','create-one');
 const a=await openSharedStore({client,workspaceId:'team',actorId:'alice',id});create(a);await a.flush();a.dispose();
 const b=await openSharedStore({client,workspaceId:'team',actorId:'bob',id});
 assert.equal(b.get('bob',id).owner_id,'team');assert.equal(b.get('bob',id).messages[0].added_by,'alice');
 b.appendReply({actor_id:'bob',request_id:id,expected_revision:0,text:'Client reply',idempotency_key:'reply'});await b.flush();
 assert.equal(b.get('bob',id).messages[1].added_by,'bob');assert.throws(()=>b.get('alice',id),/INVALID_ACTOR/);b.dispose();
});
test('simultaneous replies cannot overwrite history; same-key retries replay',async()=>{
 const client=database(),id=creationId('team','alice','create-one'),options={client,workspaceId:'team',actorId:'alice',id};
 const first=await openSharedStore(options);create(first);await first.flush();first.dispose();
 const a=await openSharedStore(options),b=await openSharedStore(options);
 const command={actor_id:'alice',request_id:id,expected_revision:0,text:'Reply one',idempotency_key:'reply-one'};
 a.appendReply(command);b.appendReply(command);await a.flush();await b.flush();assert.equal(b.get('alice',id).messages.length,2);
 const c=await openSharedStore(options),d=await openSharedStore({...options,actorId:'bob'});
 c.appendReply({...command,expected_revision:1,text:'Reply two',idempotency_key:'reply-two'});
 d.appendReply({...command,actor_id:'bob',expected_revision:1,text:'Conflicting reply',idempotency_key:'reply-bob'});
 await c.flush();await assert.rejects(d.flush(),/REVISION_CONFLICT/);
 for(const store of [a,b,c,d])store.dispose();
});
test('concurrent creation retries converge and a different payload conflicts',async()=>{
 const client=database(),id=creationId('team','alice','create-one'),options={client,workspaceId:'team',actorId:'alice',id};
 const a=await openSharedStore(options),b=await openSharedStore(options);create(a);create(b);await a.flush();await b.flush();assert.equal(client.rows.size,1);
 const c=await openSharedStore(options);assert.equal(create(c).replayed,true);assert.throws(()=>create(c,'alice','Different input'),/IDEMPOTENCY_CONFLICT/);
 for(const store of [a,b,c])store.dispose();
});
test('unassigned identities cannot persist; request IDs are isolated by workspace and creator',async()=>{
 const client=database(),id=creationId('team','outsider','create-one');const store=await openSharedStore({client,workspaceId:'team',actorId:'outsider',id});create(store,'outsider');await assert.rejects(store.flush(),/ACCESS_DENIED/);assert.equal(client.rows.size,0);store.dispose();
 assert.notEqual(creationId('team','alice','key'),creationId('other','alice','key'));assert.notEqual(creationId('team','alice','key'),creationId('team','bob','key'));
});

test('concurrent same-key analysis retries use the saved run and do not call the model twice',async()=>{
 const {analyzeSavedRequest}=await import('../requests/analyze-saved.js');
 const {createFollowUpMockProvider}=await import('../agents/follow-up/providers/mock.js');
 const client=database(),id=creationId('team','alice','create-one'),options={client,workspaceId:'team',actorId:'alice',id};
 const initial=await openSharedStore(options);create(initial);await initial.flush();initial.dispose();
 const a=await openSharedStore(options),b=await openSharedStore(options);let calls=0;
 const providers={intakeProvider:{id:'test',mode:'mock',generate:async({context})=>{calls++;return {schema_version:'1.0',run_id:context.run_id,base_record_version:context.base_record_version,proposed_changes:[],ambiguities:[]};}},followUpProvider:createFollowUpMockProvider()};
 const command={actor_id:'alice',request_id:id,expected_revision:0,idempotency_key:'same-analysis'};
 const outcomes=await Promise.all([analyzeSavedRequest(a,command,providers),analyzeSavedRequest(b,command,providers)]);
 await a.flush();await b.flush();assert.equal(calls,1);assert.ok(outcomes.some(r=>r.replayed));
 await a.refresh();assert.equal(a.analyses('alice',id).length,1);assert.equal(a.activeAnalysis('alice',id).status,'completed');a.dispose();b.dispose();
});
