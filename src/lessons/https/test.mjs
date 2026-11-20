import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectFrame, reassembleTCP } from '../../lib/bytes/index.js';
import lesson from './index.js';

test('HTTPS preserves the reference frame sizes and TLS record boundaries', () => {
  const packets = lesson.frames.map(frame => ({ ...frame, ...inspectFrame(frame) }));
  assert.deepEqual(packets.map(({ bytes }) => bytes.length), [
    75, 91, 66, 66, 60, 1514, 444, 1514, 1514, 1084, 118, 741, 532,
    1514, 1514, 1514, 1514, 1514, 1514, 1514, 1514, 1084,
  ]);
  const records = packet => packet.layers.at(-1).fields.filter(({ label }) => label === '记录长度').map(({ value }) => value);
  const reassembled = lesson.reassembly.map(({ frames }) => reassembleTCP(frames.map(id => packets.find(packet => packet.id === id)), 'tls'));
  assert.deepEqual(reassembled.map(records), [['1845 B'], ['1210 B', '1 B', '2724 B'], ['12705 B']]);
  assert.deepEqual(records(packets.find(({ id }) => id === 'tickets')), ['234 B', '234 B']);
  assert(reassembled[0].layers.at(-1).fields.some(({ label, value }) => label === '服务器名称' && value === 'www.example.com'));
});
