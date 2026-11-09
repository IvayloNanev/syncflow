import SiteHeader from '../../components/site-header';
import {requireWorkspace} from "../../lib/supabase/access";
import AnalysisWorkspace from "../../components/analysis-workspace";
export default async function Page({searchParams}:{searchParams:Promise<{request?:string}>}) {
 const {request}=await searchParams;
 const session=await requireWorkspace(`/coordinator${typeof request==="string"?`?request=${encodeURIComponent(request)}`:""}`);
 return <div className="workspace-theme" data-editor-scope={session?`${session.user.id}:${session.workspaceId}`:"local"}><SiteHeader current="coordinator" email={session?.user.email}/><AnalysisWorkspace key={typeof request==="string"?request:"new"} mode="coordinator" shared={!!session} initialRequestId={typeof request==="string"?request:undefined}/></div>;
}
