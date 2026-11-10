// Display-only excerpts from the email, never confirmed request facts.
export function inquiryLabels(text){
 const line=pattern=>text.match(pattern)?.[1]?.trim().slice(0,160)||'';
 return {title:line(/^\s*Project\s*:\s*(.+)$/im)||line(/^\s*Subject\s*:\s*(.+)$/im)||text.split('\n').map(s=>s.trim()).find(Boolean)?.slice(0,100)||'',sender:line(/^\s*From\s*:\s*(.+)$/im)||line(/^\s*Contact\s*:\s*(.+)$/im)};
}
