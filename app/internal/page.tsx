import {redirect} from 'next/navigation';
import {storageClient} from '../../lib/supabase/server';
import {loadBriefing} from '../../server/briefing-store.js';
import {caseHandoff} from '../../agents/priority/supervisor.js';
import InternalReviewTriage from '../../components/internal-review-triage';
import SiteHeader from '../../components/site-header';
import {requireWorkspace} from "../../lib/supabase/access";
import InternalReviewEmail from "../../components/internal-review-email";
export default async function Page({searchParams}:{searchParams:Promise<{request?:string;case?:string;lane?:string}>}) {
 const params=await searchParams;const request=params.request||params.case;const lane=params.lane;
 const session=await requireWorkspace(`/internal${typeof request==="string"?`?request=${encodeURIComponent(request)}`:""}`);
 if(session?.workspaceId&&typeof request==='string'){const {cases}=await loadBriefing(storageClient(),session.workspaceId,session.user.id);const c=cases.find(item=>item.id===request);if(c){const handoff=caseHandoff(c);if(handoff.state==='finished')redirect('/cases?status=completed');if(handoff.destination==='coordinator')redirect(`/coordinator?request=${encodeURIComponent(request)}`);}}
 return <div className="workspace-theme" data-editor-scope={session?`${session.user.id}:${session.workspaceId}`:"local"}><SiteHeader current="internal" email={session?.user.email}/>{!request?<InternalReviewTriage/>:<InternalReviewEmail key={request} requestId={request} lane={lane} autoAssess/> }</div>;
}
