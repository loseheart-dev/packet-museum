import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectFrame } from '../../lib/bytes/index.js';
import lesson from './index.js';

test('RTSP 帧长、请求序号和协商字段与参考一致', () => {
  const { steps, frames } = lesson;
  assert.deepEqual(steps.map(step => step.frames.length), [5, 4, 2, 2, 3, 2]);
  assert.deepEqual(frames.map(frame => frame.bytes.length), [66, 66, 60, 180, 154, 206, 158, 372, 396, 407, 200, 383, 187, 1454, 1454, 956, 368, 101]);
  const fields = (i, layer = 'RTSP') => Object.fromEntries(inspectFrame(frames[i]).layers.find(l => l.label === layer).fields.map(f => [f.label, f.value]));
  assert.deepEqual(frames.filter(f => f.protocol.startsWith('RTSP')).map(f => inspectFrame(f).layers[3].fields[1].value),
    ['1', '1', '2', '2', '3', '3', '4', '4', '5', '5', '6', '6']);
  assert.equal(fields(10).Transport, 'RTP/AVP;unicast;client_port=50000-50001;server_port=6970-6971;ssrc=5A1C3E7B');
  assert.equal(fields(10).Session, '1185d200;timeout=60');
  assert.ok(inspectFrame(frames[8]).layers.at(-1).fields.some(f => f.label === 'a=' && f.value === 'rtpmap:96 H264/90000'));
});

test('RTP 关键帧按同一时间戳拆成三个 H.264 FU-A 分片', () => {
  lesson.frames.slice(13, 16).forEach((frame, i) => {
    const { layers } = inspectFrame(frame);
    const rtp = layers.at(-1);
    assert.equal(rtp.label, 'RTP + 视频');
    assert.deepEqual(layers[2].fields.slice(0, 2).map(f => f.value), ['6970', '50000']);
    const header = new DataView(frame.bytes.buffer, frame.bytes.byteOffset + rtp.offset, rtp.length);
    assert.equal(header.getUint8(1), i === 2 ? 0xe0 : 0x60);
    assert.equal(header.getUint16(2), 27493 + i);
    assert.equal(header.getUint32(4), 3725434208);
    assert.equal(header.getUint32(8), 0x5a1c3e7b);
    assert.equal(header.getUint16(12), [0x7c85, 0x7c05, 0x7c45][i]);
    assert.equal(rtp.fields.at(-1).length, i === 2 ? 900 : 1398);
  });
});
