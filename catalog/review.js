import {assessCatalogue} from './availability.js';
import { recordings } from './recordings.js';

// Resolve IDs against server-owned metadata. Never accept catalog facts from a client.
export function resolveRecording(id) {
  if (id == null) return null;
  const recording = typeof id === 'string' && recordings.find(r => r.id === id);
  if (!recording) throw new Error('INVALID_RECORDING');
  return structuredClone(recording);
}
export function reviewRecording(id, request = {}) {
  const catalogue_assessment=assessCatalogue({messages:request.messages,fields:[...(request.confirmed_fields||[]),...(request.agent_fields||[])]});
  const recording = resolveRecording(id);
  if (!recording) return { recording: null, catalogue_assessment, source: 'synthetic_catalog', cleared: false,
    blockers: [{ code: 'RECORDING_UNRESOLVED', question: 'Confirm the exact artist, recording and version.', audience: 'coordinator' }] };
  const blockers = [{ code: 'PUBLISHING_UNVERIFIED', question: 'Verify publishing ownership and the required publishing clearance.', audience: 'coordinator' }];
  if (!recording.master_contact) blockers.push({ code: 'MASTER_CONTACT_MISSING', question: 'Find and verify the master rights contact.', audience: 'coordinator' });
  if (!recording.assets.length) blockers.push({ code: 'ASSETS_UNAVAILABLE', question: 'Verify which audio assets are available before promising delivery.', audience: 'coordinator' });
  if (recording.metadata_warning) blockers.push({ code: 'METADATA_CONFLICT', question: recording.metadata_warning, audience: 'coordinator' });
  return { recording, catalogue_assessment, source: 'synthetic_catalog', cleared: false, blockers };
}
