import test from 'node:test';
import assert from 'node:assert/strict';
import {invitationEmail,invitationStatus,invitationError} from '../lib/team-invitations.js';
test('invitation addresses normalize exact email without Gmail-style alias guessing',()=>{
 assert.equal(invitationEmail(' Alice+music@Example.COM '),'alice+music@example.com');
 for(const value of [null,{},'','a@b','a b@example.com','a@example.com\nBcc:other@example.com',`${'a'.repeat(250)}@b.co`])assert.equal(invitationEmail(value),null);
});
test('pending invitation expiry never disguises accepted or revoked records',()=>{
 const now=Date.parse('2026-11-07T12:00:00Z');
 assert.equal(invitationStatus({status:'pending',expires_at:'2026-11-07T12:00:00Z'},now),'expired');
 assert.equal(invitationStatus({status:'pending',expires_at:'2026-11-08T12:00:00Z'},now),'pending');
 for(const status of ['accepted','revoked'])assert.equal(invitationStatus({status,expires_at:'2026-11-01T12:00:00Z'},now),status);
});
test('invitation errors expose only allowlisted, actionable copy',()=>{
 assert.match(invitationError({message:'OWNER_REQUIRED'}),/owner/);
 assert.match(invitationError({message:'OTHER_WORKSPACE'}),/different workspace/);
 assert.match(invitationError({message:'INVITATION_UNAVAILABLE'}),/unavailable/);
 assert.doesNotMatch(invitationError({message:'secret SQL detail'}),/secret SQL detail/);
});
