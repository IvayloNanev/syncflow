import SiteHeader from '../../components/site-header';
import InternalReviewTriage from '../../components/internal-review-triage';
import {requireWorkspace} from '../../lib/supabase/access';
export default async function CompletedCases(){const session=await requireWorkspace('/completed-cases');return <div className="workspace-theme"><SiteHeader current="cases" email={session?.user.email}/><InternalReviewTriage browse completedOnly/></div>;}
