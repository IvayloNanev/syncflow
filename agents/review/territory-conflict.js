// Narrow, source-backed safety net for explicit repeated territorial scope.
// Compatible lists are not conflicts. Unlabeled natural-language cases remain Intake's responsibility.
export function explicitTerritoryConflict(messages) {
  for (const message of [...messages].reverse()) {
    const text=message.text;
    const correction=/\b(?:correction|corrected)\s*:?\s*territor(?:y|ies)\s*(?::|is|are)\s*[^.\n]+/gi;
    const corrections=[...text.matchAll(correction)];
    const scope=corrections.length ? text.slice(corrections.at(-1).index) : text;
    const entries=[...scope.matchAll(/\bterritor(?:y|ies)\s*:\s*([^.;\n]+)/gi)];
    const distinct=new Set(entries.map(m=>m[1].trim().toLowerCase()));
    const explicitlyUnresolved=/\bno correction (?:has been |is )?confirmed\b/i.test(scope);
    const exclusive=entries.filter(m=>/\bonly\b/i.test(m[1]));
    if(distinct.size>1 && (explicitlyUnresolved || exclusive.length>1)) {
      return entries.map(m=>({message_id:message.message_id,exact_quote:m[0]}));
    }
    if(corrections.length && !/\b(?:or|unknown|uncertain|maybe|unconfirmed)\b|\?/.test(scope.toLowerCase())) return null; // A later explicitly corrected territory supersedes earlier contradictions.
  }
  return null;
}
