import WorkOverview from '../../../components/work-overview';
export default async function Cases({searchParams}:{searchParams:Promise<{view?:string}>}){const {view}=await searchParams;return <WorkOverview casesOnly initialFilter={['waiting','completed'].includes(view||'')?view:'active'}/>;}
