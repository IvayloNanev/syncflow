'use client';
export default function AccountMenu({email}:{email?:string}){
 if(!email)return null;
 return <form action="/auth/signout" method="post" className="account-menu" onSubmit={()=>{for(const key of Object.keys(sessionStorage)){if(key.startsWith('syncflow-editor:'))sessionStorage.removeItem(key);}}}><span>{email}</span><button type="submit">Sign out</button></form>;
}
