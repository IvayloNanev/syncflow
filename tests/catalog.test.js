import test from 'node:test';
import assert from 'node:assert/strict';
import { recordings, searchRecordings } from '../catalog/recordings.js';
import { scenarios } from '../catalog/scenarios.js';

test('synthetic catalog has 1,000 unique recordings, no cleared rights, and reserved example contacts', () => {
  assert.equal(recordings.length, 1000);
  assert.equal(new Set(recordings.map(r => r.id)).size, 1000);
  for (const r of recordings) {
    assert.equal(r.synthetic, true);
    assert.ok(!r.master_contact || r.master_contact.endsWith('@example.com'));
    assert.ok(['Requires verification', 'Missing information'].includes(r.publishing_status));
  }
});
for (const scenario of scenarios) test(`catalog scenario ${scenario.id}: ${scenario.name}`, () => {
  assert.deepEqual(searchRecordings(scenario.query).map(r => r.id), scenario.expected);
});
test('version filter disambiguates and matching ignores case and punctuation', () => {
  assert.deepEqual(searchRecordings('NORTHERN lights maya rivers', { version: 'Instrumental' }).map(r => r.id), ['TRACK-0002']);
  assert.equal(searchRecordings('track 1000')[0].id, 'TRACK-1000');
});
test('edge cases really contain missing contacts, assets and conflicting metadata', () => {
  assert.equal(searchRecordings('TRACK-0018')[0].master_contact, null);
  assert.deepEqual(searchRecordings('TRACK-0012')[0].assets, []);
  assert.ok(searchRecordings('TRACK-0030')[0].metadata_warning);
  assert.equal(scenarios.find(s => s.id === 'C10').split_required, true);
});
