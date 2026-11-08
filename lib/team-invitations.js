export function invitationEmail(value){
 if(typeof value!=='string')return null;
 const email=value.trim().toLowerCase();
 return email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)?email:null;
}
export function invitationStatus(invite,now=Date.now()){
 return invite.status==='pending'&&Date.parse(invite.expires_at)<=now?'expired':invite.status;
}
export function invitationError(error){
 const message=error?.message||'';
 for(const [code,text] of Object.entries({OWNER_REQUIRED:'Only a workspace owner can manage invitations.',INVALID_EMAIL:'Enter a complete email address.',ALREADY_MEMBER:'That person already belongs to this workspace.',INVITATION_LIMIT:'The invitation limit has been reached. Revoke unused invitations or try again tomorrow.',VERIFIED_EMAIL_REQUIRED:'Verify your account email before accepting an invitation.',OTHER_WORKSPACE:'Your account already belongs to a different workspace. Contact your workspace owner before joining another.',INVITATION_UNAVAILABLE:'This invitation is unavailable, expired, revoked, or intended for a different account.'})){
  if(message===code)return text;
 }
 return 'The invitation could not be updated. Check your connection and try again.';
}
