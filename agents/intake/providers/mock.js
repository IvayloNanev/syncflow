import { readFileSync } from 'node:fs';

export const scenarios = ['complete', 'incomplete', 'partial-reply'];
const fixture = scenario => {
  if (!scenarios.includes(scenario)) throw new Error('Unknown mock scenario');
  // Never reads evaluation/held-out or sends data over the network.
  return JSON.parse(readFileSync(new URL(`../../../fixtures/development/${scenario}.json`, import.meta.url), 'utf8'));
};
export const developmentContext = scenario => structuredClone(fixture(scenario).context);

/** Fixed development answers, NOT a parser, model, or accuracy demonstration. */
export function createMockProvider(scenario) {
  const example = fixture(scenario);
  return {
    id: `development-fixture:${scenario}`,
    mode: 'mock',
    async generate({ context, signal }) {
      signal.throwIfAborted();
      // Refuse unfamiliar messages/state instead of presenting canned facts as extraction.
      for (const key of ['messages', 'confirmed_fields', 'unresolved_issues', 'checklist_version']) {
        if (JSON.stringify(context[key]) !== JSON.stringify(example.context[key])) {
          const error = new Error('Unsupported mock context');
          error.code = 'UNSUPPORTED_MOCK_INPUT';
          throw error;
        }
      }
      return { ...structuredClone(example.intake), run_id: context.run_id,
        base_record_version: context.base_record_version };
    },
  };
}
