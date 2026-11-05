import {requireWorkspace} from "../../lib/supabase/access";
import AccountMenu from "../../components/account-menu";
import Link from "next/link";
import PageNavigation from "../../components/page-navigation";
import AnalysisWorkspace from "../../components/analysis-workspace";
export default async function Page({searchParams}:{searchParams:Promise<{request?:string}>}) {
 const session=await requireWorkspace();
 const {request}=await searchParams;
 return <div className="workspace-theme" data-editor-scope={session?`${session.user.id}:${session.workspaceId}`:"local"}><header className="portal-bar"><Link href="/">SyncFlow · Internal review</Link><PageNavigation current="internal" /><AccountMenu email={session?.user.email}/></header><AnalysisWorkspace mode="internal" initialRequestId={typeof request==="string"?request:undefined}/></div>;
}
