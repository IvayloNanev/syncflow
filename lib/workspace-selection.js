// Members are ordered oldest workspace first by the server.
// Cookie is a preference, never authorization: selection must match live membership.
export function selectWorkspace(members,preferred){
 if(preferred){const member=members.find(m=>m.workspace_id===preferred);if(member)return member;}
 return members[0]??null;
}
