import { readdirSync, readFileSync } from 'node:fs';
import { validateFixture } from './validate.js';
const folder = new URL('../fixtures/development/', import.meta.url);
for (const file of readdirSync(folder).filter(n => n.endsWith('.json'))) {
  validateFixture(JSON.parse(readFileSync(new URL(file, folder), 'utf8')));
  console.log(`PASS ${file}`);
}
