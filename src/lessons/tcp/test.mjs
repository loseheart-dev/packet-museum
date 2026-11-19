import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectFrame } from '../../lib/bytes/index.js';
import lesson from './index.js';

test('TCP 选项、SACK、同段重传及双向序号与原站一致', () => {
  assert.deepEqual(lesson.steps.map(step => step.frames.length), [3, 2, 2, 1, 2, 4]);
  const segments = lesson.frames.map(frame => {
    const layer = inspectFrame(frame).layers.find(({ label }) => label === 'TCP');
    const header = new DataView(frame.bytes.buffer, frame.bytes.byteOffset + layer.offset, layer.length);
    return {
      fields: [header.getUint16(0), header.getUint16(2), header.getUint32(4), header.getUint32(8), header.getUint8(13)],
      options: frame.bytes.slice(layer.offset + 20, layer.offset + layer.length),
      payload: frame.bytes.slice(layer.offset + layer.length),
    };
  });
  const c = 49152, s = 80;
  assert.deepEqual(segments.map(({ fields }) => fields), [
    [c, s, 0, 0, 2], [s, c, 0, 1, 18], [c, s, 1, 1, 16], [c, s, 1, 1, 24], [s, c, 1, 79, 16],
    [s, c, 1, 79, 16], [s, c, 1461, 79, 24], [c, s, 79, 1, 16], [s, c, 1, 79, 16], [c, s, 79, 2921, 16],
    [c, s, 79, 2921, 17], [s, c, 2921, 80, 16], [s, c, 2921, 80, 17], [c, s, 80, 2922, 16],
  ]);
  assert.deepEqual(lesson.frames.map(({ bytes }) => bytes.length), [66, 66, 54, 132, 54, 1514, 1514, 66, 1514, 54, 54, 54, 54, 54]);
  assert.deepEqual(segments.map(({ payload }) => payload.length), [0, 0, 0, 78, 0, 1460, 1460, 0, 1460, 0, 0, 0, 0, 0]);
  assert.deepEqual([...segments[0].options], [2, 4, 5, 180, 1, 3, 3, 8, 1, 1, 4, 2]);
  assert.deepEqual([...segments[1].options], [2, 4, 5, 180, 1, 1, 4, 2, 1, 3, 3, 7]);
  assert.deepEqual([...segments[7].options], [1, 1, 5, 10, 0, 0, 5, 181, 0, 0, 11, 105]);
  assert.deepEqual(lesson.frames.filter(frame => frame.outcome === 'dropped').map(frame => frame.id), ['tcp-6']);
  assert.deepEqual(segments[8].payload, segments[5].payload);
  assert.match(new TextDecoder().decode(segments[3].payload), /^GET \/ HTTP\/1\.1\r\nHost: www\.example\.com\r\n/);
});
