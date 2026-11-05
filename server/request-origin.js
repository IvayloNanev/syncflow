/** Canonical browser origin, never an arbitrary forwarded-host value.
 * Production requires an explicit deployment origin; development permits loopback.
 */
export function requestOrigin(req,{configured=process.env.SYNCFLOW_APP_ORIGIN,production=process.env.NODE_ENV==='production'}={}){
 if(configured){
  try{const url=new URL(configured);if(url.username||url.password||url.pathname!=='/'||url.search||url.hash)return null;
   if(url.protocol!=='https:'&&!(url.protocol==='http:'&&!production&&['localhost','127.0.0.1'].includes(url.hostname)))return null;
   return url.origin;
  }catch{return null;}
 }
 if(production)return null;
 const host=req.headers.get('host');return host&&/^(127\.0\.0\.1|localhost)(:\d{1,5})?$/.test(host)?`http://${host}`:null;
}
