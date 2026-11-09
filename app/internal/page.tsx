import InternalReviewTriage from '../../components/internal-review-triage';
import SiteHeader from '../../components/site-header';
import {requireWorkspace} from "../../lib/supabase/access";
import InternalReviewEmail from "../../components/internal-review-email";
export default async function Page({searchParams}:{searchParams:Promise<{request?:string;lane?:string}>}) {
 const {request,lane}=await searchParams;
 const session=await requireWorkspace(`/internal${typeof request==="string"?`?request=${encodeURIComponent(request)}`:""}`);
 return <div className="workspace-theme" data-editor-scope={session?`${session.user.id}:${session.workspaceId}`:"local"}><SiteHeader current="internal" email={session?.user.email}/>{!request?<InternalReviewTriage/>:<InternalReviewEmail key={request} requestId={request} lane={lane} autoAssess/> }</div>;
}
