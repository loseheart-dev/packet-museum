import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectFrame } from '../../lib/bytes/index.js';
import lesson from './index.js';

test('IPv4 原站帧长、两个方向的 NAT 和逐跳注记', () => {
  const [request, response, ...packets] = lesson.frames;
  assert.deepEqual(lesson.steps.map(step => step.frames.length), [0, 2, 1, 1, 2]);
  assert.deepEqual(lesson.frames.map(frame => frame.bytes.length), [60, 60, 66, 66, 66, 66]);
  assert.deepEqual(request.bytes.slice(0, 6), new Uint8Array(6).fill(255));
  assert.deepEqual(response.bytes.slice(0, 6), request.bytes.slice(6, 12));

  const u16 = (bytes, offset) => new DataView(bytes.buffer, bytes.byteOffset).getUint16(offset);
  assert.deepEqual(packets.map(({ bytes }) => bytes[22]), [128, 127, 64, 52]);
  assert.deepEqual(packets.map(frame => {
    const { src, dst } = inspectFrame(frame);
    return [src, u16(frame.bytes, 34), dst, u16(frame.bytes, 36)];
  }), [
    ['192.168.1.10', 52344, '203.0.113.10', 443],
    ['198.51.100.7', 40112, '203.0.113.10', 443],
    ['203.0.113.10', 443, '198.51.100.7', 40112],
    ['203.0.113.10', 443, '192.168.1.10', 52344],
  ]);
  assert.deepEqual(packets.slice(1, 3).map(frame => frame.path), [['router', 'internet', 'web'], ['web', 'internet', 'router']]);
  assert.equal(lesson.steps[3].events[0].after, 'syn-wan');
});
