import { recordings } from './recordings.js';

const normalize = value => ` ${value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
// Deliberately conservative local hints. These never confirm fields or replace agent validation.
export function previewEmail(email) {
  const text = normalize(email);
  const ids = [...new Set(email.match(/TRACK-\d{4}/gi) || [])].map(id => id.toUpperCase());
  const titles = [...new Set(recordings.map(r => r.title))].filter(title => text.includes(normalize(title)));
  const artists = [...new Set(recordings.map(r => r.artist))].filter(artist => text.includes(normalize(artist)));
  const versions = ['Original', 'Instrumental', 'Live', 'Remix'].filter(version => text.includes(normalize(version)));
  const candidates = recordings.filter(r => (ids.length ? ids.includes(r.id) : titles.includes(r.title))
    && (!titles.length || titles.includes(r.title)) && (!artists.length || artists.includes(r.artist))
    && (!versions.length || versions.includes(r.version)));
  const match = candidates.length === 1 && ids.length <= 1 && titles.length <= 1 && artists.length <= 1 && versions.length <= 1 ? candidates[0] : null;
  /** @type {[string, RegExp][]} */
  const checks = [
    ['Client / contact', /(?:contact\s*:|i[’']m\s+\w+|this is\s+\w+|from\s*:)/i],
    ['Project name', /project\s*:\s*\S+/i],
    ['Intended use', /advertis|campaign|film|television|podcast|video game|trailer|online ad/i],
    ['Media / platforms', /youtube|instagram|tiktok|facebook|television|broadcast|cinema|spotify/i],
    ['Territory', /canada|canadian|worldwide|united states|united kingdom|north america|europe/i],
    ['Campaign term', /(?:\d+|one|two|three|four|five|six|twelve)\s*(?:-| )?(?:months?|years?|weeks?)\b/i],
    ['Amount of music', /(?:\d+|thirty|sixty)\s*(?:-| )?(?:seconds?|minutes?)\b/i],
    ['Budget amount', /(?:CAD|USD|GBP|EUR|\$|€|£)\s*[\d,]+|budget\s*:\s*[\d,]+/i],
    ['Budget currency', /\b(?:CAD|USD|GBP|EUR)\b/i],
    ['Budget rights scope', /both rights|master and publishing|master only|publishing only/i],
    ['Response deadline', /(?:reply|respond|response|deadline)[\s\S]{0,35}(?:\d|november|december|january|february|march|april|may|june|july|august|september|october)/i],
  ];
  const missing = checks.filter(([, pattern]) => !pattern.test(email)).map(([name]) => name);
  if (!match) missing.unshift('Exact catalog recording');
  return { match, candidates: candidates.slice(0, 8), missing };
}
