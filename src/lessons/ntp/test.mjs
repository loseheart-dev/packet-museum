import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inspectFrame } from '../../lib/bytes/index.js';
import { delay, offset, t4 } from './frames.js';
import lesson from './index.js';

test('NTP 用两个 90 字节帧交换 T1、T2、T3，T4 由客户端记录', () => {
  const [request, answer] = lesson.frames.map(frame => {
    assert.equal(frame.bytes.length, 90);
    const { layers } = inspectFrame(frame);
    assert.deepEqual(layers.map(layer => layer.label), ['Ethernet II', 'IPv4', 'UDP', 'NTP']);
    const udp = new DataView(frame.bytes.buffer, frame.bytes.byteOffset + layers[2].offset, layers[2].length);
    assert.equal(udp.getUint16(0), 123);
    assert.equal(udp.getUint16(2), 123);
    const layer = layers.at(-1);
    assert.equal(layer.offset, 42);
    assert.equal(layer.length, 48);
    return Object.fromEntries(layer.fields.map(({ label, value }) => [label, value]));
  });
  assert.equal(request['闰秒指示、版本、模式'], '0, 3, 3');
  assert.equal(request['发送时间'], '09:40:59.750000 UTC');
  assert.deepEqual(['参考时间', '起始时间', '接收时间'].map(label => request[label]), ['0', '0', '0']);
  assert.equal(answer['闰秒指示、版本、模式'], '0, 3, 4');
  assert.equal(answer['层级'], '2');
  assert.equal(answer['参考 ID'], '192.0.2.123');
  assert.equal(answer['起始时间'], request['发送时间']);
  assert.equal(answer['接收时间'], '09:41:00.012000 UTC');
  assert.equal(answer['发送时间'], '09:41:00.012100 UTC');
  assert.equal(t4.toFixed(6), (Date.UTC(2026, 10, 7, 9, 40, 59) / 1000 + .7741).toFixed(6));
  assert.equal(offset, '250.0 ms');
  assert.equal(delay, '24.0 ms');
});
