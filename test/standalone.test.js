import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { buildStandalone, standalonePath } from '../scripts/build-standalone.js';

test('root index.html matches the current standalone build', async () => {
  const committed = await readFile(standalonePath, 'utf8');
  assert.ok(committed === await buildStandalone(), 'Run npm run build:standalone to update index.html');
});
