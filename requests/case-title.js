import {inquiryLabels} from './inquiry-labels.js';
// Use the same saved source title in the case register, queue and review panel.
export function caseTitle(c){return c.summary?.project||inquiryLabels(c.messages?.[0]?.text||'').title||c.summary?.track||c.subject||`Request ${c.id.slice(0,8)}`;}
