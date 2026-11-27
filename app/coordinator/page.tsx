import {redirect} from 'next/navigation';
import {storageClient} from '../../lib/supabase/server';
import {loadBriefing} from '../../server/briefing-store.js';
import {caseHandoff} from '../../agents/priority/supervisor.js';
import SiteHeader from '../../components/site-header';
import {requireWorkspace} from "../../lib/supabase/access";
import AnalysisWorkspace from "../../components/analysis-workspace";
export default async function Page({searchParams}:{searchParams:Promise<{request?:string}>}) {
 const {request}=await searchParams;
 const session=await requireWorkspace(`/coordinator${typeof request==="string"?`?request=${encodeURIComponent(request)}`:""}`);
 if(session?.workspaceId&&typeof request==='string'){const {cases}=await loadBriefing(storageClient(),session.workspaceId,session.user.id);const c=cases.find(item=>item.id===request);if(c){const handoff=caseHandoff(c);if(handoff.state==='finished')redirect('/cases?status=completed');if(handoff.destination==='internal')redirect(`/internal?request=${encodeURIComponent(request)}`);}}
 return <div className="workspace-theme" data-editor-scope={session?`${session.user.id}:${session.workspaceId}`:"local"}><SiteHeader current="coordinator" email={session?.user.email} demo={session?.demo}/><AnalysisWorkspace key={typeof request==="string"?request:"new"} mode="coordinator" shared={!!session} initialRequestId={typeof request==="string"?request:undefined}/></div>;
}
