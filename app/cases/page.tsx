import SiteHeader from '../../components/site-header';
import InternalReviewTriage from '../../components/internal-review-triage';
import {requireWorkspace} from '../../lib/supabase/access';
export default async function Cases(){const session=await requireWorkspace('/cases');return <div className="workspace-theme"><SiteHeader current="cases" email={session?.user.email}/><InternalReviewTriage browse/></div>;}
