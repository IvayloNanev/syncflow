export async function readDemo(client,workspace,actor){
 const {data,error}=await client.from('syncflow_demo_runs').select('state,version').eq('workspace_id',workspace).eq('actor_id',actor).maybeSingle();
 if(error)throw Error('DEMO_STORAGE_FAILED');return data;
}
export async function writeDemo(client,workspace,actor,expected,state){
 const row={workspace_id:workspace,actor_id:actor,version:expected+1,state};
 if(expected===0){const {error}=await client.from('syncflow_demo_runs').insert(row);if(error)throw Error(error.code==='23505'?'DEMO_CONFLICT':'DEMO_STORAGE_FAILED');}
 else{const {data,error}=await client.from('syncflow_demo_runs').update(row).eq('workspace_id',workspace).eq('actor_id',actor).eq('version',expected).select('version').maybeSingle();if(error)throw Error('DEMO_STORAGE_FAILED');if(!data)throw Error('DEMO_CONFLICT');}
 return row.version;
}
