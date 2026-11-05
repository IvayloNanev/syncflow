import Link from "next/link";
import PageNavigation from "../../components/page-navigation";
import AnalysisWorkspace from "../../components/analysis-workspace";
export default async function Page({searchParams}:{searchParams:Promise<{request?:string}>}) {
 const {request}=await searchParams;
 return <><header className="portal-bar"><Link href="/">SyncFlow · Coordinator</Link><PageNavigation current="coordinator" /></header><AnalysisWorkspace mode="coordinator" initialRequestId={typeof request==="string"?request:undefined}/></>;
}
