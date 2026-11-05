import {writeFileSync} from 'node:fs';import {createHash} from 'node:crypto';
const base='Contact: Nora Vale at Pine Studio. Project: River launch. Artist: Iris North. Track title: Copper Window. Recording version: original recording. Intended use: brand advertisement. Platforms: YouTube and Instagram. Term: four months. Music length: 25 seconds. Budget: EUR 4200 for both rights. Response deadline: December 10, 2026 at 15:30 Europe/Berlin. ';
const cases=[
 ['V01','Territory: Germany only. Territory: France only.',true,false],
 ['V02','Territory: Italy. Territory: Spain. No correction has been confirmed.',true,false],
 ['V03','Territories: Germany and France.',false,false],
 ['V04','Territory: Germany only. Territory: France only.',false,false,'Correction: territory is Japan.'],
 ['V05','Territory: Germany.',false,true],
 ['V06','Territory: Germany.',false,false,'Platforms: Vimeo and cinema screenings.'],
].map(([id,scope,conflict,missing_platforms,reply])=>({id,expect:{conflict,missing_platforms},context:{schema_version:'1.0',run_id:id,request_id:id,base_record_version:0,checklist_version:'intake-v1',coordinator_timezone:'Europe/Berlin',messages:[{message_id:'initial',kind:'initial',text:(['V05','V06'].includes(id)?base.replace('Platforms: YouTube and Instagram.','The advertisement will be online.'):base)+scope,supplied_message_date:null},...(reply?[{message_id:'reply',kind:'reply',text:reply,supplied_message_date:null}]:[])],confirmed_fields:[],unresolved_issues:[]}}));
const bytes=JSON.stringify(cases,null,2)+'\n';writeFileSync(new URL('./quality-fix-v1.json',import.meta.url),bytes);writeFileSync(new URL('./quality-fix-v1.sha256',import.meta.url),createHash('sha256').update(bytes).digest('hex')+'\n');
