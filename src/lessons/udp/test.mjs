import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectFrame } from '../../lib/bytes/index.js';
import lesson from './index.js';

test('UDP preserves the call’s two RTP streams and its single lost datagram', () => {
  assert.deepEqual(lesson.steps.map(step => step.frames.length), [1, 4, 3, 3, 0]);
  assert.deepEqual(lesson.steps.slice(1, 4).map(step => step.parallel[0]), lesson.steps.slice(1, 4).map(step => step.frames));
  assert.deepEqual(lesson.frames.filter(frame => frame.outcome === 'dropped').map(frame => [frame.time, frame.path.at(-1)]), [['0.120s', 'web']]);
  const records = lesson.frames.map(frame => {
    const { layers } = inspectFrame(frame);
    assert.deepEqual(layers.map(layer => layer.length), [14, 20, 8, 92]);
    const bytes = new DataView(frame.bytes.buffer, frame.bytes.byteOffset, frame.bytes.length);
    assert.equal(bytes.getUint16(38), 100);
    return [bytes.getUint16(34), bytes.getUint16(36), bytes.getUint16(42), bytes.getUint16(44), bytes.getUint32(46), bytes.getUint32(50)];
  });
  assert.deepEqual(records, [
    [50000, 5004, 0x80ef, 21738, 2617440, 1590076113],
    [50000, 5004, 0x806f, 21739, 2618400, 1590076113],
    [50000, 5004, 0x806f, 21740, 2619360, 1590076113],
    [50000, 5004, 0x806f, 21741, 2620320, 1590076113],
    [50000, 5004, 0x806f, 21742, 2621280, 1590076113],
    [50000, 5004, 0x806f, 21743, 2622240, 1590076113],
    [50000, 5004, 0x806f, 21744, 2623200, 1590076113],
    [50000, 5004, 0x806f, 21745, 2624160, 1590076113],
    [5004, 50000, 0x80ef, 4419, 913280, 460833806],
    [5004, 50000, 0x806f, 4420, 914240, 460833806],
    [5004, 50000, 0x806f, 4421, 915200, 460833806],
  ]);
});
