// Reset the local synthetic browser database (issue #18).
// Deletes only .syncflow-data/browser-requests.sqlite and its SQLite sidecar files, after confirmation.
// Stop `pnpm dev` first. This cannot be undone; the prototype has no backup.
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';

const dir = join(process.cwd(), '.syncflow-data');
const files = ['', '-wal', '-shm', '-journal'].map(suffix => join(dir, `browser-requests.sqlite${suffix}`)).filter(existsSync);
if (!files.length) {
  console.log('No local request database found. Nothing to reset.');
} else {
  console.log('This permanently deletes the local SyncFlow request database:');
  for (const file of files) console.log(`  ${file}`);
  let answer = process.argv.includes('--yes') ? 'reset' : '';
  if (!answer) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    answer = (await rl.question('Type "reset" to continue: ')).trim();
    rl.close();
  }
  if (answer !== 'reset') {
    console.log('Cancelled. Nothing was deleted.');
  } else {
    for (const file of files) rmSync(file, { force: true });
    console.log('Local request database deleted. It is recreated empty the next time the app saves a request.');
  }
}
