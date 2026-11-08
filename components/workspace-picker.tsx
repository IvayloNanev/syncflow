import {sessionClient} from '../lib/supabase/server';
import {switchWorkspace} from '../app/workspace/actions';
export default async function WorkspacePicker({selected}:{selected?:string|null}){
 const client=await sessionClient();
 const {data,error}=await client.from('syncflow_workspaces').select('id,name').order('created_at');
 if(error)throw new Error('Workspace names could not load.');
 if(!data?.length)return null;
 return <form action={switchWorkspace} className="workspace-picker"><label htmlFor="workspace-choice">Workspace</label><select id="workspace-choice" name="workspace_id" defaultValue={selected||''} required><option value="" disabled>Choose a workspace</option>{data.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select><button type="submit" className="secondary-button">Open workspace</button></form>;
}
