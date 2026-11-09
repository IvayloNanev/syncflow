// Keep authentication returns inside allowlisted app routes; never accept arbitrary redirects.
export function workspaceDestination(value) {
 if(typeof value!=='string'||value.length>600||!/^\/(dashboard|coordinator|internal|team|invitations|demo)(\?|$)/.test(value)||/[\\\r\n]/.test(value))return '/dashboard';
 const url=new URL(value,'https://syncflow.invalid');
 const request=url.searchParams.get('request');
 return url.pathname+(['/coordinator','/internal'].includes(url.pathname)&&request&&/^[a-zA-Z0-9-]{1,100}$/.test(request)?`?request=${encodeURIComponent(request)}`:'');
}
export function loginDestination(next,options={}) {
 return '/login?'+new URLSearchParams({...options,next:workspaceDestination(next)}).toString();
}
