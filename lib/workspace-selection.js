// Cookie is a preference, never authorization: selection must match live membership.
export function selectWorkspace(members,preferred){
 if(preferred){const member=members.find(m=>m.workspace_id===preferred);if(member)return member;}
 return members.length===1?members[0]:null;
}
