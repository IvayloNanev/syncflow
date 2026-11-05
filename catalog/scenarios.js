// Expected catalog candidates are deterministic; these are not model evaluation scores.
export const scenarios = [
  { id: 'C01', name: 'Exact recording ID', query: 'TRACK-0001', expected: ['TRACK-0001'], email: 'Contact: Jordan Pike. We want TRACK-0001, Northern Lights by Maya Rivers (Original), for a Canadian advertising campaign for six months. Our budget is CAD 5,000 for both rights.' },
  { id: 'C02', name: 'Same title, several recordings', query: 'Northern Lights', expected: ['TRACK-0001','TRACK-0002','TRACK-0003','TRACK-0004','TRACK-0005','TRACK-0006','TRACK-0007','TRACK-0008'], email: 'We want Northern Lights for an advertising campaign in Canada for six months. Our budget is $5,000.' },
  { id: 'C03', name: 'Artist still needs a version', query: 'Northern Lights Maya Rivers', expected: ['TRACK-0001','TRACK-0002','TRACK-0003','TRACK-0004'], email: 'We want Northern Lights by Maya Rivers for a Canadian ad. Which version can we use?' },
  { id: 'C04', name: 'Instrumental requested', query: 'Northern Lights Maya Rivers Instrumental', expected: ['TRACK-0002'], email: 'We need the instrumental of Northern Lights by Maya Rivers for a web advertisement in Canada.' },
  { id: 'C05', name: 'Different artist', query: 'Northern Lights Theo Vale Original', expected: ['TRACK-0005'], email: 'Please license Northern Lights by Theo Vale, original version, for six months of Canadian television advertising.' },
  { id: 'C06', name: 'Recording absent', query: 'Unlisted Comet', expected: [], email: 'We want Unlisted Comet by Unknown Example Artist for a Canadian advertising campaign.' },
  { id: 'C07', name: 'Missing rights contact', query: 'TRACK-0018', expected: ['TRACK-0018'], email: 'We want TRACK-0018 for a Canadian online campaign. Who handles the master rights?' },
  { id: 'C08', name: 'Missing assets', query: 'TRACK-0012', expected: ['TRACK-0012'], email: 'We want TRACK-0012 for a film trailer. Can you supply an instrumental file?' },
  { id: 'C09', name: 'Conflicting metadata', query: 'TRACK-0030', expected: ['TRACK-0030'], email: 'We want TRACK-0030 for advertising in Canada. Please verify the publisher before proceeding.' },
  { id: 'C10', name: 'Multiple recordings: split required', query: 'Northern Lights', expected: ['TRACK-0001','TRACK-0002','TRACK-0003','TRACK-0004','TRACK-0005','TRACK-0006','TRACK-0007','TRACK-0008'], email: 'We want both TRACK-0001 and TRACK-0005 for two separate Canadian advertisements, with different budgets. Please handle both songs.', split_required: true },
];
