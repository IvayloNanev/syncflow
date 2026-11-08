import test from 'node:test';
import assert from 'node:assert/strict';
import {workspaceDestination,loginDestination} from './auth-destination.js';
test('authentication returns to the selected workspace request without unrelated parameters',()=>{
 assert.equal(workspaceDestination('/internal?request=abc-123&ignored=yes'),'/internal?request=abc-123');
 assert.equal(workspaceDestination('/coordinator?request=abc-123'),'/coordinator?request=abc-123');
 const login=new URL(loginDestination('/internal?request=abc-123',{mode:'signup'}),'https://syncflow.invalid');
 assert.equal(login.searchParams.get('next'),'/internal?request=abc-123');
 assert.equal(login.searchParams.get('mode'),'signup');
});
test('authentication destinations reject external, traversal and malformed return targets',()=>{
 for(const value of [undefined,null,{},'https://evil.example','//evil.example','/internal/../login','/internal\\evil','/login?next=https://evil.example','/internal\n?request=a','/internal.evil','/internal#x'])assert.equal(workspaceDestination(value),'/dashboard');
 assert.equal(workspaceDestination('/internal?request=%2F%2Fevil.example'),'/internal');
});

test('ordinary login defaults to the client-history dashboard while request links retain their target',()=>{assert.equal(workspaceDestination(undefined),'/dashboard');assert.equal(workspaceDestination('/dashboard'),'/dashboard');assert.equal(workspaceDestination('/coordinator?request=abc-123'),'/coordinator?request=abc-123');});
