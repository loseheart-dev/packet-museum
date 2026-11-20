import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inspectFrame, reassembleTCP } from '../../lib/bytes/index.js';
import lesson from './index.js';

const frames = new Map(lesson.frames.map(frame => [frame.id, frame]));
const decode = id => ({ ...frames.get(id), ...inspectFrame(frames.get(id)) });
const field = (id, label) => decode(id).layers.at(-1).fields.find(item => item.label === label);

test('WebRTC: 八步、20 条包流记录与参考帧长', () => {
  assert.deepEqual(lesson.steps.map(({ frames: ids }) => ids.map(id => frames.get(id).bytes.length)), [
    [109, 106], [62, 74], [1514, 1514, 1514, 442, 1514, 1514, 1514, 502],
    [1514, 1514, 100, 1514, 1514, 76], [130, 106], [218, 714, 622, 117],
    [144, 144, 144, 1182, 1182, 812], [],
  ]);
  const reassembled = lesson.reassembly.map(group => reassembleTCP(group.frames.map(decode), group.application));
  assert.equal(frames.size - lesson.reassembly.reduce((n, group) => n + group.frames.length - 1, 0), 20);
  assert.deepEqual(reassembled.map(packet => packet.layers[0].length), [4768, 4780, 2930, 2942]);
});

test('WebRTC: STUN 事务、DTLS 配置及 SRTP 标记与时钟', () => {
  for (const [request, response] of [['binding-request', 'binding-response'], ['ice-check', 'ice-response']]) {
    assert.equal(field(request, '事务 ID').value, field(response, '事务 ID').value);
    assert.equal(field(response, 'XOR 端口').value, 61022);
    assert.equal(field(response, 'XOR 映射地址').value, '198.51.100.7');
  }
  assert.equal(field('ice-check', 'USERNAME').value, 'q7Rz:Hk2w');
  assert.equal(field('server-hello', 'SRTP 保护配置').value, 'SRTP_AEAD_AES_128_GCM');
  assert.equal(field('finished', 'Finished（加密）').length, 48);
  assert.equal(Number(field('audio-2', '时间戳').value) - Number(field('audio-1', '时间戳').value), 960);
  assert.equal(field('video-3', '标记位、载荷类型').value, '1，96（VP8，按 SDP 中的约定）');
  assert.equal(field('video-3', '认证标签').length, 16);
});
