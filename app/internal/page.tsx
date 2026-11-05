import Link from "next/link";
import PageNavigation from "../../components/page-navigation";
import AnalysisWorkspace from "../../components/analysis-workspace";
export default async function Page({searchParams}:{searchParams:Promise<{request?:string}>}) {
 const {request}=await searchParams;
 return <div className="workspace-theme"><header className="portal-bar"><Link href="/">SyncFlow · Internal review</Link><PageNavigation current="internal" /></header><AnalysisWorkspace mode="internal" initialRequestId={typeof request==="string"?request:undefined}/></div>;
}
