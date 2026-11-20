import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectFrame } from '../../lib/bytes/index.js';
import { frames } from './frames.js';

test('QUIC uses the original UDP ports, directions and frame lengths', () => {
  assert.deepEqual(frames.map(frame => frame.bytes.length), [1292, 1292, 1304, 1392, 1392, 272, 1292, 392, 1257, 73]);
  const client = inspectFrame(frames[0]);
  const server = inspectFrame(frames[2]);
  assert.deepEqual([client.src, client.dst, server.src, server.dst], ['192.168.1.10', '203.0.113.10', '203.0.113.10', '192.168.1.10']);
  assert.deepEqual([client, server].map(packet => packet.layers[2].fields.slice(0, 2).map(field => field.value)), [['59214', '443'], ['443', '59214']]);
});

test('QUIC inspects coalesced long headers and short headers separately', () => {
  const packets = id => inspectFrame(frames.find(frame => frame.id === id)).layers.slice(3);
  const finished = packets('finished');
  assert.deepEqual(finished.map(({ label, offset, length }) => [label, offset, length]), [
    ['QUIC · Initial', 42, 1165], ['QUIC · Handshake', 1207, 85],
  ]);
  assert.equal(finished[0].fields.find(field => field.label === '令牌长度').value, '0');
  assert(!finished[1].fields.some(field => field.label === '令牌长度'));
  const [request] = packets('request');
  assert.deepEqual(request.fields.map(field => field.label), ['头部类型', '目标连接 ID', '包号', '加密载荷']);
  assert.equal(request.fields[1].value, '3e c7 52 09 f8 6a 21 d4');
  assert.match(request.fields.at(-1).value, /示例.*GET \//);

  const malformed = { ...frames[6], bytes: frames[6].bytes.slice() };
  malformed.bytes[67] = 0;
  assert.throws(() => inspectFrame(malformed), RangeError);
});
