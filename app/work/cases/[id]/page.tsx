import {notFound} from 'next/navigation';
import WorkCase from '../../../../components/work-case';
export default async function Case({params}:{params:Promise<{id:string}>}){const {id}=await params;if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))notFound();return <WorkCase requestId={id}/>;}
