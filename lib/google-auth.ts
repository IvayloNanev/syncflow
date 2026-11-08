// Provider settings are public; never expose the server key to discover them.
export async function googleAuthEnabled(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)return false;
 try{const response=await fetch(`${url}/auth/v1/settings`,{headers:{apikey:key},cache:'no-store',signal:AbortSignal.timeout(3000)});if(!response.ok)return false;return (await response.json()).external?.google===true;}catch{return false;}
}
