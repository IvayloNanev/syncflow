// Deterministic synthetic metadata only. No commercial recordings or rights claims.
const adjectives = ['Amber', 'Quiet', 'Silver', 'Velvet', 'Distant', 'Golden', 'Electric', 'Hidden', 'Midnight', 'Open'];
const nouns = ['Horizon', 'River', 'City', 'Echo', 'Garden', 'Sky', 'Road', 'Ocean', 'Window', 'Morning'];
const artists = ['Maya Rivers', 'Theo Vale', 'Lena Harbor', 'Noah Ember', 'Iris Lane', 'Milo North', 'Ada Bloom', 'Eli Stone', 'Nina Coast', 'Owen Reed'];
const versions = ['Original', 'Instrumental', 'Live', 'Remix'];
const genres = ['Pop', 'Electronic', 'Folk', 'Rock', 'Soul'];
export const recordings = Array.from({ length: 1000 }, (_, i) => {
  const song = Math.floor(i / 4);
  return {
    id: `TRACK-${String(i + 1).padStart(4, '0')}`,
    title: song < 2 ? 'Northern Lights' : `${adjectives[song % 10]} ${nouns[Math.floor(song / 10) % 10]} ${Math.floor(song / 100) + 1}`,
    artist: artists[song % 10], version: versions[i % 4],
    genre: genres[song % 5], mood: ['Uplifting', 'Reflective', 'Energetic', 'Calm'][song % 4],
    bpm: 70 + (song * 7) % 100,
    label: `Example Label ${song % 5 + 1}`,
    master_contact: i % 17 === 0 ? null : `label${song % 5 + 1}@example.com`,
    publishing_status: i % 7 === 0 ? 'Missing information' : 'Requires verification',
    assets: i % 11 === 0 ? [] : ['Full mix', ...(i % 4 === 0 ? ['Instrumental'] : [])],
    metadata_warning: i % 29 === 0 ? 'Conflicting publisher entries: coordinator must verify source records.' : null,
    synthetic: true,
  };
});
const normalize = value => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export function searchRecordings(query, { version = '', genre = '' } = {}) {
  const terms = normalize(query).split(' ').filter(Boolean);
  return recordings.filter(r => (!version || r.version === version) && (!genre || r.genre === genre)
    && terms.every(term => normalize(`${r.id} ${r.title} ${r.artist} ${r.version}`).includes(term)));
}
