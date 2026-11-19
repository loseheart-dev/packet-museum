import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectFrame } from '../../lib/bytes/index.js';
import lesson from './index.js';

test('公网转发只改变 TTL、IPv4 校验和与链路 MAC，家用路由器才做 NAT', () => {
  const [request, response, ...packets] = lesson.frames;
  assert.deepEqual(lesson.frames.map(frame => frame.bytes.length), [42, 42, 66, 66, 66, 66, 66, 66]);
  assert.deepEqual(request.bytes.slice(0, 6), new Uint8Array(6).fill(255));
  assert.deepEqual(response.bytes.slice(0, 6), request.bytes.slice(6, 12));

  const u16 = (bytes, offset) => new DataView(bytes.buffer, bytes.byteOffset).getUint16(offset);
  assert.deepEqual(packets.map(({ bytes }) => bytes[22]), [128, 127, 116, 64, 53, 52]);
  assert.deepEqual(packets.map(frame => {
    const { src, dst } = inspectFrame(frame);
    return [src, u16(frame.bytes, 34), dst, u16(frame.bytes, 36)];
  }), [
    ['192.168.1.10', 52344, '203.0.113.10', 443],
    ['198.51.100.7', 40112, '203.0.113.10', 443],
    ['198.51.100.7', 40112, '203.0.113.10', 443],
    ['203.0.113.10', 443, '198.51.100.7', 40112],
    ['203.0.113.10', 443, '198.51.100.7', 40112],
    ['203.0.113.10', 443, '192.168.1.10', 52344],
  ]);
  for (const i of [1, 3]) {
    const [a, b] = packets.slice(i, i + 2).map(frame => frame.bytes);
    assert.notDeepEqual(a.slice(0, 6), b.slice(0, 6));
    assert.notDeepEqual(a.slice(6, 12), b.slice(6, 12));
    assert.equal(u16(b, 24), u16(a, 24) + 11 * 256);
    assert.deepEqual(a.slice(14, 22), b.slice(14, 22));
    assert.deepEqual(a.slice(26), b.slice(26));
  }
});
