import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectFrame } from '../../lib/bytes/index.js';
import lesson from './index.js';

test('Ethernet broadcasts only the ARP request and preserves bytes on switch egress', () => {
  const { frames } = lesson;
  const hex = bytes => Buffer.from(bytes).toString('hex');
  assert.equal(hex(frames[0].bytes), 'ffffffffffff00005e0053100806000108000604000100005e005310c0a8010a000000000000c0a80114');
  assert.equal(hex(frames[3].bytes), '00005e00531000005e0053200806000108000604000200005e005320c0a8011400005e005310c0a8010a');
  assert.deepEqual(frames.slice(1, 3).map(frame => frame.path), [['switch', 'lan'], ['switch', 'router']]);
  for (const [ingress, egress] of [[0, 1], [0, 2], [3, 4], [5, 6], [7, 8], [9, 10]]) {
    assert.deepEqual(frames[ingress].bytes, frames[egress].bytes);
  }
});

test('Ethernet rewrites link addresses, source IP and source port at the router, not the destination IP', () => {
  const [lan, wan] = [lesson.frames[10], lesson.frames[11]];
  for (const [frame, macs, src, port, ttl] of [
    [lan, ['00:00:5e:00:53:01', '00:00:5e:00:53:10'], '192.168.1.10', 52344, 128],
    [wan, ['00:00:5e:00:53:fe', '00:00:5e:00:53:02'], '198.51.100.7', 40112, 127],
  ]) {
    const parsed = inspectFrame(frame);
    assert.deepEqual(parsed.layers[0].fields.slice(0, 2).map(field => field.value), macs);
    assert.deepEqual([parsed.src, parsed.dst], [src, '203.0.113.10']);
    assert.equal(frame.bytes.length, 66);
    assert.equal(frame.bytes[22], ttl);
    const tcp = new DataView(frame.bytes.buffer, frame.bytes.byteOffset + 34);
    assert.deepEqual([tcp.getUint16(0), tcp.getUint16(2), tcp.getUint32(4)], [port, 443, 0xb5cc295f]);
  }
});
