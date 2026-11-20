import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectFrame } from '../../lib/bytes/index.js';
import { parseMembership } from './frames.js';
import lesson from './index.js';

test('IGMPv2 的组地址、应答时限、Router Alert 和组播 MAC 与演示一致', () => {
  for (const frame of lesson.frames.filter(frame => frame.protocol === 'IGMPv2')) {
    const { dst, link, layers: [, ip, payload] } = inspectFrame(frame);
    assert.equal(frame.bytes.length, 60);
    assert.equal(frame.bytes[ip.offset + 8], 1);
    assert.equal(frame.bytes[ip.offset + 9], 2);
    assert.deepEqual([...frame.bytes.slice(payload.offset - 4, payload.offset)], [0x94, 4, 0, 0]);
    const bytes = frame.bytes.slice(payload.offset, payload.offset + payload.length);
    const { fields } = parseMembership(bytes, payload.offset);
    assert.deepEqual(fields.map(f => f.offset), [38, 39, 40, 42]);
    assert.deepEqual([fields[1].value, fields[3].value, link.dst], {
      '224.0.0.1': ['10 s', '0.0.0.0', '01:00:5e:00:00:01'],
      '224.0.0.2': ['0', '233.252.0.1', '01:00:5e:00:00:02'],
      '233.252.0.1': [bytes[0] === 0x11 ? '1 s' : '0', '233.252.0.1', '01:00:5e:7c:00:01'],
    }[dst]);
    bytes[7] ^= 1;
    assert.throws(() => parseMembership(bytes, payload.offset), /IGMPv2 校验和/);
  }
});

test('频道的交换机副本保持原帧字节，路由转发只改变源 MAC、TTL 和 IPv4 校验和', () => {
  const [incoming, lan, tv, next, nextLan, laptopCopy, tvCopy] = [4, 5, 6, 9, 10, 11, 12].map(i => lesson.frames[i - 1].bytes);
  assert.deepEqual(tv, lan);
  assert.deepEqual(laptopCopy, nextLan);
  assert.deepEqual(tvCopy, nextLan);
  for (const [input, output, cc] of [[incoming, lan, 4], [next, nextLan, 9]]) {
    assert.deepEqual([...input.keys()].filter(i => input[i] !== output[i]), [11, 22, 24]);
    assert.equal(input[22] - output[22], 1);
    assert.deepEqual(inspectFrame({ bytes: output }).layers.map(({ length }) => length), [14, 20, 8, 1316]);
    assert.deepEqual([...output.slice(34, 38)], [0x13, 0x88, 0x04, 0xd2]);
    for (let i = 0; i < 7; i++) assert.deepEqual([...output.slice(42 + i * 188, 46 + i * 188)], [0x47, 1, 0, 0x10 | ((cc + i) & 15)]);
  }
});
