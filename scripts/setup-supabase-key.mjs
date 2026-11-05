// Temporary loopback-only credential setup. No key is logged or returned to HTML.
import {createServer} from 'node:http';
import {randomBytes} from 'node:crypto';
import {readFile,writeFile,chmod} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import {config} from 'dotenv';
config({path:'.env.local',quiet:true});
const token=randomBytes(24).toString('hex');let busy=false;
const page=(message='')=>`<!doctype html><meta name="viewport" content="width=device-width"><title>Connect SyncFlow</title><style>body{font:18px system-ui;background:#10150f;color:#f3efdf;max-width:520px;margin:12vh auto;padding:24px}h1{font-size:36px}p{line-height:1.6;color:#c7c7b5}input,button{box-sizing:border-box;width:100%;padding:16px;border-radius:12px;font:inherit;margin:12px 0}input{background:#1c231a;color:white;border:1px solid #bfa86a}button{background:#ddc589;border:0;cursor:pointer}</style><h1>Connect SyncFlow.</h1><p>Copy the full <strong>syncflow_local_server</strong> secret key from Supabase, then paste it below.</p>${message?`<p role="status">${message}</p>`:''}<form method="post"><label for="key">Server secret key</label><input id="key" name="key" type="password" autocomplete="off" required placeholder="Paste the secret key here"><button>Connect securely</button></form><p>This page runs only on your computer. The key is saved to your ignored local environment file and never displayed in chat.</p>`;
const server=createServer(async(req,res)=>{
 const origin=`http://127.0.0.1:${server.address().port}`;
 res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
 if(req.headers.host!==new URL(origin).host||req.url!==`/${token}`){res.writeHead(404).end('Not found');return;}
 if(req.method==='GET'){res.end(page());return;}
 if(req.method!=='POST'||req.headers.origin!==origin||busy){res.writeHead(403).end('Use the setup page.');return;}
 busy=true;
 try{
  let raw='';for await(const chunk of req){raw+=chunk.toString();if(Buffer.byteLength(raw)>4096){res.writeHead(413).end('Key is too large');return;}}
  let key=new URLSearchParams(raw).get('key')?.trim();raw='';
  if(!key||!/^sb_secret_[A-Za-z0-9_-]{25,}$/.test(key)){res.writeHead(400).end(page('Paste the complete secret key, not the masked prefix.'));return;}
  const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {error}=await client.from('syncflow_workspaces').select('id').limit(1);
  if(error){res.writeHead(400).end(page('That key could not connect to SyncFlow. Copy the full secret key and try again.'));return;}
  const file=new URL('../.env.local',import.meta.url);let env=await readFile(file,'utf8');
  env=env.replace(/^SUPABASE_SECRET_KEY=.*$/m,`SUPABASE_SECRET_KEY=${key}`);await writeFile(file,env,{mode:0o600});await chmod(file,0o600);key=undefined;env='';
  res.end('<!doctype html><title>SyncFlow connected</title><h1>SyncFlow is connected.</h1><p>You can close this tab and return to the chat.</p>');console.log('Server key validated and saved. No credential values logged.');setTimeout(()=>server.close(),1000);
 }catch{res.writeHead(500).end(page('Setup could not complete. Please try again.'));}finally{busy=false;}
});
server.listen(0,'127.0.0.1',()=>console.log(`Open http://127.0.0.1:${server.address().port}/${token}`));
setTimeout(()=>server.close(),15*60*1000).unref();
