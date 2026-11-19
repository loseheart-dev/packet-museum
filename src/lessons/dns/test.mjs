import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import lesson from './index.js';

test('DNS 用构造器重建样稿 A 的全部字节', () => {
  const html = readFileSync(new URL('../../../design/mockup-a.html', import.meta.url), 'utf8');
  const reference = JSON.parse(html.match(/id="frames">([\s\S]*?)<\/script>/)[1]);
  assert.deepEqual(lesson.frames.map(frame => [...frame.bytes]), reference);
});
