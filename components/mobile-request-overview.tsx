import {coverageRows} from '../catalog/coverage-view.js';
import type RequestCoverage from './request-coverage';
export default function MobileRequestOverview(props:Parameters<typeof RequestCoverage>[0]){
 const rows=coverageRows(props),missing=rows.filter(row=>row.state==='missing'),attention=rows.filter(row=>row.state==='attention');
 if(!rows.length)return null;
 return <section className="mobile-request-overview" aria-labelledby="mobile-request-overview-heading"><h2 id="mobile-request-overview-heading">Request overview</h2><p>{missing.length} {props.analyzed&&!props.stale?'missing':'not detected'} · {attention.length} need clarification</p>{missing.length||attention.length?<p>{[...missing,...attention].slice(0,3).map(row=>row.label).join(' · ')}{missing.length+attention.length>3?' · More in the checklist':''}</p>:<p>All request details supplied. Internal checks and rights verification still apply.</p>}<a href="#request-checklist">Review request details</a></section>;
}
