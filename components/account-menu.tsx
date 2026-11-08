'use client';
import {hasUnsavedEditors} from './use-unsaved-guard';
export default function AccountMenu({email}:{email?:string}){
 if(!email)return null;
 return <form action="/auth/signout" method="post" className="account-menu" onSubmit={event=>{if(hasUnsavedEditors()&&!window.confirm('Sign out with unfinished edits? Your recovery copies stay in this tab and are only restored for this account and workspace.'))event.preventDefault();}}><span>{email}</span><button type="submit">Sign out</button></form>;
}
