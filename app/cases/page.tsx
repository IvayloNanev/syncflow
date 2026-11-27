import {Suspense} from 'react';
import SiteHeader from '../../components/site-header';
import InternalReviewTriage from '../../components/internal-review-triage';
import {requireWorkspace} from '../../lib/supabase/access';
export default async function Cases(){const session=await requireWorkspace('/cases');return <div className="workspace-theme"><SiteHeader current="cases" email={session?.user.email} demo={session?.demo}/><Suspense fallback={<main className="team-workspace"><p role="status">Loading saved cases…</p></main>}><InternalReviewTriage browse/></Suspense></div>;}
