import Link from "next/link";
import PageNavigation from "../../components/page-navigation";
import AnalysisWorkspace from "../../components/analysis-workspace";
export default function InternalPage() { return <><header className="portal-bar"><Link href="/">SyncFlow · Coordinator workspace</Link><PageNavigation current="internal" /></header><AnalysisWorkspace /></>; }
