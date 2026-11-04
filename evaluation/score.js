// Conservative deterministic scoring. Synonyms/semantic equivalence need human adjudication.
const normalize = value => {
  if (typeof value === 'string') return value.trim().replace(/\s+/g,' ').toLowerCase();
  if (Array.isArray(value)) return value.map(normalize).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).filter(k=>k!=='supplied_text').sort().map(k=>[k,normalize(value[k])]));
  return value;
};
export const equivalent = (a,b) => JSON.stringify(normalize(a))===JSON.stringify(normalize(b));
const signature = issue => `${issue.severity}:${issue.type}:${[...issue.field_keys].sort().join(',')}`;
export function scoreCase(fixture, result) {
  const expected = new Map(fixture.intake.proposed_changes.map(p=>[p.field_key,p.proposed_value]));
  const actual = new Map((result.stages?.intake?.output?.proposed_changes||[]).map(p=>[p.field_key,p.proposed_value]));
  const facts = { expected:expected.size, proposed:actual.size, matched:0, missing:[], unexpected:[], mismatched:[] };
  for (const [key,value] of expected) {
    if (!actual.has(key)) facts.missing.push(key);
    else if (equivalent(value,actual.get(key))) facts.matched++;
    else facts.mismatched.push({field:key,expected:value,actual:actual.get(key)});
  }
  for (const key of actual.keys()) if (!expected.has(key)) facts.unexpected.push(key);
  const expectedIssues = new Set(fixture.review.issues.map(signature));
  const actualIssues = new Set((result.stages?.review?.output?.issues||[]).map(signature));
  const missingIssues=[...expectedIssues].filter(x=>!actualIssues.has(x));
  const extraIssues=[...actualIssues].filter(x=>!expectedIssues.has(x));
  const requiredFields=new Set(fixture.review.issues.flatMap(i=>i.field_keys));
  const flaggedFields=new Set((result.stages?.review?.output?.issues||[]).flatMap(i=>i.field_keys));
  const follow=result.stages?.follow_up;
  const preserved=(fixture.expected_behavior?.must_preserve_fields||[]).filter(key=>actual.has(key));
  return {
    pipeline_ok:result.ok, failed_stage:result.failed_stage||null, error_code:result.error?.code||null,
    facts, issue_signatures:{expected:expectedIssues.size,actual:actualIssues.size,matched:expectedIssues.size-missingIssues.length,missing:missingIssues,extra:extraIssues},
    issue_fields:{expected:requiredFields.size,matched:[...requiredFields].filter(k=>flaggedFields.has(k)).length},
    preservation_violations:preserved,
    draft_reference_validation:follow?.ok===true&&!follow.skipped,
    draft_skipped:follow?.skipped===true,
    manual_prose_review_required:true,
  };
}
export function summarize(cases) {
  const sum=fn=>cases.reduce((n,c)=>n+fn(c.score),0);
  const matched=sum(s=>s.facts.matched),proposed=sum(s=>s.facts.proposed),expected=sum(s=>s.facts.expected);
  const issueMatched=sum(s=>s.issue_signatures.matched),issueExpected=sum(s=>s.issue_signatures.expected),issueActual=sum(s=>s.issue_signatures.actual);
  return {cases:cases.length,pipeline_successes:sum(s=>Number(s.pipeline_ok)),facts:{matched,proposed,expected,precision:proposed?matched/proposed:null,recall:expected?matched/expected:null},
    issue_signatures:{matched:issueMatched,expected:issueExpected,actual:issueActual,precision:issueActual?issueMatched/issueActual:null,recall:issueExpected?issueMatched/issueExpected:null},
    issue_fields:{expected:sum(s=>s.issue_fields.expected),matched:sum(s=>s.issue_fields.matched)},
    preservation_violations:sum(s=>s.preservation_violations.length),validated_drafts:sum(s=>Number(s.draft_reference_validation)),skipped_drafts:sum(s=>Number(s.draft_skipped))};
}
