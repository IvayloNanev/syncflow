import test from 'node:test';
import assert from 'node:assert/strict';
import {googleAuthEnabled} from '../lib/google-auth.ts';
import {noticeFor} from '../lib/auth-messages.js';

test('Google entry is exposed only when the configured provider reports enabled',async t=>{
 const previous={url:process.env.NEXT_PUBLIC_SUPABASE_URL,key:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY};
 t.after(()=>{for(const [name,value] of [['NEXT_PUBLIC_SUPABASE_URL',previous.url],['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',previous.key]]){if(value===undefined)delete process.env[name];else process.env[name]=value;}});
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.supabase.co';process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='publishable-fixture';
 const fetch=t.mock.method(globalThis,'fetch',async(url,options)=>{assert.equal(url,'https://example.supabase.co/auth/v1/settings');assert.equal(options.headers.apikey,'publishable-fixture');return new Response(JSON.stringify({external:{google:true}}));});
 assert.equal(await googleAuthEnabled(),true);
 fetch.mock.mockImplementation(async()=>new Response(JSON.stringify({external:{google:false}})));
 assert.equal(await googleAuthEnabled(),false);
 fetch.mock.mockImplementation(async()=>new Response('{}',{status:503}));assert.equal(await googleAuthEnabled(),false);
 fetch.mock.mockImplementation(async()=>{throw new Error('private provider failure');});assert.equal(await googleAuthEnabled(),false);
 delete process.env.NEXT_PUBLIC_SUPABASE_URL;assert.equal(await googleAuthEnabled(),false);
});

test('cancelled and unavailable Google login return to sign-in, not email confirmation',()=>{
 for(const code of ['google-failed','google-unavailable']){assert.equal(noticeFor(code).view,'signin');assert.equal(noticeFor(code).tone,'error');}
});
