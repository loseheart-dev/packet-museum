import assert from 'node:assert/strict';
import test from 'node:test';
import { concat, inspectFrame } from '../../lib/bytes/index.js';
import { checksum, transportChecksum } from '../../lib/bytes/core.js';
import lesson from './index.js';

const byId = Object.fromEntries(lesson.frames.map(frame => [frame.id, frame]));
const layers = id => inspectFrame(byId[id]).layers.filter(layer => layer.label === 'RTMP');
const payload = id => concat(...layers(id).map(({ offset, length }) => byId[id].bytes.subarray(offset, offset + length)));
const fields = id => layers(id).flatMap(layer => layer.fields);

test('RTMP mirrors the reference exchanges, with continuous checksummed TCP segments', () => {
  assert.deepEqual(lesson.steps.map(step => step.frames.length), [6, 2, 2, 2, 2, 2]);
  assert.deepEqual(lesson.frames.map(frame => frame.bytes.length), [66, 66, 60, 1645, 3235, 1644, 257, 305, 203, 95, 113, 171, 500, 31158, 156, 174]);
  const next = new Map();
  for (const frame of lesson.frames) {
    const { layers, src, dst } = inspectFrame(frame);
    for (const ip of layers.filter(layer => layer.label === 'IPv4')) {
      const view = new DataView(frame.bytes.buffer, frame.bytes.byteOffset + ip.offset);
      const length = view.getUint16(2);
      const tcp = frame.bytes.subarray(ip.offset + ip.length, ip.offset + length);
      assert.equal(checksum(frame.bytes.subarray(ip.offset, ip.offset + ip.length)), 0);
      assert.equal(transportChecksum(src, dst, 6, tcp), 0);
      const seq = view.getUint32(ip.length + 4), ack = view.getUint32(ip.length + 8), flags = tcp[13];
      assert.equal(seq, next.get(src) ?? seq);
      assert.equal(ack, next.get(dst) ?? 0);
      const data = tcp.length - (tcp[12] >> 4) * 4;
      assert(data <= 1460);
      next.set(src, seq + data + Number(Boolean(flags & 2)));
    }
  }
});

test('RTMP decodes handshake echoes, AMF0 commands and the eight video chunks', () => {
  const c = payload('c0-c1'), s = payload('s0-s1-s2');
  assert.equal(c[0], 3);
  assert.equal(s[0], 3);
  assert.deepEqual(s.subarray(1537), c.subarray(1));
  assert.deepEqual(payload('c2'), s.subarray(1, 1537));
  assert(fields('connect').some(field => field.label === 'tcUrl' && field.value === '"rtmp://live.example.com/live"'));
  assert(fields('stream-created').some(field => field.label === 'Stream ID' && field.value === '1'));
  assert(fields('publish').some(field => field.label === '消息流' && field.value === '1'));
  assert(fields('metadata').some(field => field.label === 'audiosamplerate' && field.value === '48000'));
  const video = payload('key-frame');
  assert.equal(video.length, 30024);
  assert.equal(fields('key-frame').filter(field => field.value === '类型 3，分块流 6').length, 7);
  for (let i = 0; i < 7; i++) assert.equal(video[12 + 4096 + i * 4097], 0xc6);
});
