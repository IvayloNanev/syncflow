import {requireWorkspace} from "../../lib/supabase/access";
import AccountMenu from "../../components/account-menu";
import Link from "next/link";
import PageNavigation from "../../components/page-navigation";
import AnalysisWorkspace from "../../components/analysis-workspace";
export default async function Page({searchParams}:{searchParams:Promise<{request?:string}>}) {
 const {request}=await searchParams;
 const session=await requireWorkspace(`/coordinator${typeof request==="string"?`?request=${encodeURIComponent(request)}`:""}`);
 return <div className="workspace-theme" data-editor-scope={session?`${session.user.id}:${session.workspaceId}`:"local"}><header className="portal-bar"><Link href="/">SyncFlow · Coordinator</Link><PageNavigation current="coordinator" /><AccountMenu email={session?.user.email}/></header><AnalysisWorkspace key={typeof request==="string"?request:"new"} mode="coordinator" shared={!!session} initialRequestId={typeof request==="string"?request:undefined}/></div>;
}
