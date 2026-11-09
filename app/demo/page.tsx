import SiteHeader from '../../components/site-header';
import DemoJourneys from '../../components/demo-journeys';
import {requireWorkspace} from '../../lib/supabase/access';
export const dynamic='force-dynamic';
export default async function Demo(){const session=await requireWorkspace('/demo');return <div className="workspace-theme"><SiteHeader current="dashboard" email={session?.user.email}/><DemoJourneys/></div>;}
