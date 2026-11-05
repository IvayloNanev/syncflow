import test from 'node:test';
import assert from 'node:assert/strict';
import {dashboardRequest} from '../requests/dashboard.js';
const request={confirmed_fields:[{field_key:'project',state:'confirmed',value:'Northstar'},{field_key:'client_contact',state:'proposed',value:'Do not show as confirmed'},{field_key:'response_deadline',state:'confirmed',value:{date:'2026-11-12',supplied_text:'November 12'}}]};
test('dashboard exposes confirmed labels and date without inventing time or timezone',()=>{
  const row=dashboardRequest(request,{status:'Needs analysis',reasons:['Analyze again'],next_action:'Recheck'}, {reviewers:[]});
  assert.equal(row.project,'Northstar');assert.equal(row.contact,null);assert.equal(row.deadline.date,'2026-11-12');assert.equal(row.deadline.time,null);assert.equal(row.deadline.timezone,null);assert.equal(row.responsible,'Coordinator');
});
test('dashboard names outstanding reviewers and never treats internal completion as clearance',()=>{
  const row=dashboardRequest(request,{status:'Internal review pending',reasons:['Reconfirm'],next_action:'Get decisions'}, {reviewers:[{name:'Morgan',role:'Director',status:'Approved',needs_reconfirmation:true},{name:'Jamie',role:'Global',status:'Approved',needs_reconfirmation:false}]});
  assert.equal(row.responsible,'Morgan (Director)');
  const complete=dashboardRequest(request,{status:'Internal review complete',reasons:[],next_action:'Continue licensing'}, {reviewers:[]});
  assert.match(complete.blocker,/Rights verification and licensing remain separate/);
});
