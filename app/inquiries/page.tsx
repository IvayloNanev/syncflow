import SiteHeader from '../../components/site-header';
import NewInquiries from '../../components/new-inquiries';
import {requireWorkspace} from '../../lib/supabase/access';
export const dynamic='force-dynamic';
export default async function Inquiries(){
 const session=await requireWorkspace('/inquiries');
 return <div className="workspace-theme" data-editor-scope={session?`${session.user.id}:${session.workspaceId}`:'local'}><SiteHeader current="inquiries" email={session?.user.email}/><NewInquiries key={session?.workspaceId}/></div>;
}
