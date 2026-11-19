import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectFrame, reassembleTCP } from '../../lib/bytes/index.js';
import lesson from './index.js';

test('HTTP 课堂保留 DNS、TCP 握手和 HTTP/1.1 的七条包流记录', () => {
  assert.deepEqual(lesson.steps.map(step => step.frames?.length ?? 0), [0, 2, 3, 10, 0]);
  assert.deepEqual(lesson.frames.map(frame => frame.bytes.length), [75, 91, 66, 66, 60, 484, ...Array(8).fill(1514), 1017]);
  const packets = lesson.frames.map(frame => ({ ...frame, ...inspectFrame(frame) }));
  const field = (layer, name) => layer.fields.find(({ label }) => label === name).value;
  assert.deepEqual(packets.slice(2, 6).map(packet => field(packet.layers[2], '标志')), ['SYN', 'SYN · ACK', 'ACK', 'PSH · ACK']);
  const request = packets[5].layers.at(-1), response = reassembleTCP(packets.slice(6), 'http').layers[0];
  assert.equal(field(request, '起始行'), 'GET / HTTP/1.1');
  assert.equal(field(request, '首部行'), 'Host: www.example.com');
  assert.equal(field(response, '起始行'), 'HTTP/1.1 200 OK');
  assert(response.fields.some(({ label, value }) => label === '首部行' && value === 'Content-Length: 12500'));
  assert.equal(response.fields.at(-1).length, 12500);
  assert.equal(Math.ceil(response.length / 1460), 9);
});
