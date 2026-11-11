import Ajv from 'ajv';
import shared from '../../../contracts/shared.schema.json' with {type:'json'};
import outputSchema from '../../../contracts/intake.schema.json' with {type:'json'};

// Group equal field types to keep strict grammar compilation bounded. The
// original business contract still uses one typed change per field.
const branches=shared.$defs.change.oneOf;
export const intakeFieldGroups={text:branches.filter(b=>b.properties.proposed_value.type==='string').map(b=>b.properties.field_key.const),lists:branches.filter(b=>b.properties.proposed_value.type==='array').map(b=>b.properties.field_key.const),...Object.fromEntries(branches.filter(b=>b.properties.proposed_value.type==='object').map(b=>[b.properties.field_key.const,[b.properties.field_key.const]]))};
const wireSchema=structuredClone(outputSchema);
// Legacy stored outputs may omit classification; new model output must specify it.
wireSchema.properties.ambiguities.items.required=[...new Set([...wireSchema.properties.ambiguities.items.required,'issue_type'])];
wireSchema.properties.proposed_changes={type:'object',additionalProperties:false,required:Object.keys(intakeFieldGroups),properties:Object.fromEntries(Object.entries(intakeFieldGroups).map(([group,fields])=>{
  const branch=branches.find(b=>b.properties.field_key.const===fields[0]);
  const grouped=group==='text'||group==='lists';
  return [group,{type:'array',maxItems:fields.length,description:'Empty when absent, unchanged, or conflicting. At most one proposal per field.',items:{type:'object',additionalProperties:false,required:[...(grouped?['field_key']:[]),'value','evidence'],properties:{...(grouped?{field_key:{type:'string',enum:fields}}:{}),value:branch.properties.proposed_value,evidence:branch.properties.evidence}}}];
}))};
function inline(value) {
  if(Array.isArray(value))return value.map(inline);
  if(!value||typeof value!=='object')return value;
  if(value.$ref){const name=value.$ref.split('#/$defs/')[1];if(name==='evidence')return {$ref:'#/$defs/evidence'};throw Error('Unsupported schema reference');}
  if(Object.hasOwn(value,'const'))return {type:typeof value.const,enum:[value.const]};
  return Object.fromEntries(Object.entries(value).filter(([key])=>!['$schema','$id','title'].includes(key)).map(([key,item])=>[key,inline(item)]));
}
// Optional components are omitted on the wire and restored as null locally.
// This avoids a cross-product of nullable branches in the compiled grammar.
function optionalComponents(value) {
  if(Array.isArray(value))return value.map(optionalComponents);
  if(!value||typeof value!=='object')return value;
  const result=Object.fromEntries(Object.entries(value).map(([key,item])=>[key,optionalComponents(item)]));
  if(result.type==='object')for(const [key,property] of Object.entries(result.properties)) {
    if(property.anyOf?.length===2&&property.anyOf.some(branch=>branch.type==='null')) {
      result.properties[key]=property.anyOf.find(branch=>branch.type!=='null');
      result.required=result.required.filter(name=>name!==key);
    }
  }
  return result;
}
const localSchema=optionalComponents({...inline(wireSchema),$defs:{evidence:shared.$defs.evidence}});
// Move bounds and regexes into descriptions to keep the strict grammar small. Never remove them from local
// validation. https://platform.claude.com/docs/en/build-with-claude/structured-outputs
function strictSchema(value) {
  if(Array.isArray(value))return value.map(strictSchema);
  if(!value||typeof value!=='object')return value;
  const result={},constraints=[];
  for(const [key,item] of Object.entries(value)) {
    if(['minimum','maximum','minLength','maxLength','uniqueItems','maxItems','pattern'].includes(key)){constraints.push(`${key}: ${JSON.stringify(item)}`);continue;}
    result[key]=strictSchema(item);
  }
  if(constraints.length)result.description=[result.description,...constraints].filter(Boolean).join('; ');
  return result;
}
export const intakeToolSchema=strictSchema(localSchema);
const validateWire=new Ajv({allErrors:true,strict:true}).compile(localSchema);
export function decodeIntakeToolOutput(input,context) {
  if(!validateWire(input))return null;
  const proposed_changes=Object.entries(input.proposed_changes).flatMap(([group,entries])=>entries.map(({field_key:providedField,value,evidence})=>{
    const field_key=providedField??intakeFieldGroups[group][0];
    const confirmed=context.confirmed_fields.find(field=>field.field_key===field_key&&field.state==='confirmed');
    const original=branches.find(branch=>branch.properties.field_key.const===field_key).properties.proposed_value;
    const proposed_value=original.type==='object'?Object.fromEntries(Object.keys(original.properties).map(key=>[key,value[key]??null])):value;
    return {proposal_id:`proposal-${field_key}`,field_key,previous_value:structuredClone(confirmed?.value??null),proposed_value,evidence};
  }));
  if(new Set(proposed_changes.map(change=>change.field_key)).size!==proposed_changes.length)return null;
  return {...input,proposed_changes};
}
