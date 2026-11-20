import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectFrame } from '../../lib/bytes/index.js';
import lesson from './index.js';
import { parseICMP } from './frames.js';

test('ICMP 回显、探测 TTL 与错误引用匹配原站样本', () => {
  const { frames } = lesson;
  const payloads = frames.map(frame => frame.bytes.subarray(34));
  assert.equal(lesson.steps.length, 6);
  assert.deepEqual(frames.map(frame => frame.bytes.length), [74, 74, 74, 102, 74, 70, 74, 74, 60, 88]);
  assert.deepEqual(frames.map(frame => frame.bytes[22]), [128, 52, 1, 64, 2, 254, 13, 52, 128, 52]);

  const fields = payloads.map((bytes, i) => i === 8 ? null : parseICMP(bytes, 34).fields.map(field => field.value));
  for (const [index, type, sequence] of [[0, 8, 1], [1, 0, 1], [2, 8, 2], [4, 8, 3], [6, 8, 4], [7, 0, 4]]) {
    assert.match(fields[index][0], new RegExp(`^${type} `));
    assert.equal(fields[index][1], '0');
    assert.deepEqual(fields[index].slice(3), ['0x0001', String(sequence), 'abcdefghijklmnopqrstuvwabcdefghi']);
  }
  for (const [error, probe, type, code, quoteTTL, length] of [[3, 2, 11, 0, 1, 60], [5, 4, 11, 0, 1, 28], [9, 8, 3, 3, 116, 46]]) {
    const quote = payloads[error].subarray(8);
    const original = frames[probe].bytes.subarray(14, 14 + length);
    assert.deepEqual([...payloads[error].subarray(0, 2)], [type, code]);
    assert.equal(quote.length, length);
    assert.equal(quote[8], quoteTTL);
    assert.deepEqual(quote.subarray(0, 8), original.subarray(0, 8));
    assert.equal(quote[9], original[9]);
    assert.deepEqual(quote.subarray(12), original.subarray(12));
  }
  const udp = inspectFrame(frames[8]).layers.find(layer => layer.label === 'UDP');
  assert.deepEqual(udp.fields.slice(0, 3).map(field => field.value), ['52500', '9999', '26 B']);
});
