import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectFrame } from '../../lib/bytes/index.js';
import lesson from './index.js';

test('IGMPv2 的组地址、应答时限、Router Alert 和组播 MAC 与演示一致', () => {
  for (const frame of lesson.frames.filter(frame => frame.protocol === 'IGMPv2')) {
    const { dst, link, layers } = inspectFrame(frame);
    const [, ip, { fields }] = layers;
    assert.deepEqual(layers.map(({ label }) => label), ['Ethernet II', 'IPv4', 'IGMPv2', 'Padding']);
    assert.equal(frame.bytes.length, 60);
    assert.equal(frame.bytes[ip.offset + 8], 1);
    assert.equal(ip.fields.find(field => field.label === '协议').value, '2 · IGMP');
    assert.deepEqual(ip.fields.at(-1), { label: 'Router Alert 选项', offset: 34, length: 4, value: '94 04 00 00' });
    assert.deepEqual(fields.map(f => f.offset), [38, 39, 40, 42]);
    assert.deepEqual([fields[1].value, fields[3].value, link.dst], {
      '224.0.0.1': ['10 s', '0.0.0.0', '01:00:5e:00:00:01'],
      '224.0.0.2': ['0', '233.252.0.1', '01:00:5e:00:00:02'],
      '233.252.0.1': [frame.bytes[38] === 0x11 ? '1 s' : '0', '233.252.0.1', '01:00:5e:7c:00:01'],
    }[dst]);
    const bytes = frame.bytes.slice();
    bytes[45] ^= 1;
    assert.throws(() => inspectFrame({ ...frame, bytes }), /IGMPv2 校验和/);
  }
});

test('频道的交换机副本保持原帧字节，路由转发只改变源 MAC、TTL 和 IPv4 校验和', () => {
  const [incoming, lan, tv, next, nextLan, laptopCopy, tvCopy] = [4, 5, 6, 9, 10, 11, 12].map(i => lesson.frames[i - 1].bytes);
  assert.deepEqual(tv, lan);
  assert.deepEqual(laptopCopy, nextLan);
  assert.deepEqual(tvCopy, nextLan);
  for (const [input, output, cc, frame] of [[incoming, lan, 4, lesson.frames[4]], [next, nextLan, 9, lesson.frames[9]]]) {
    assert.deepEqual([...input.keys()].filter(i => input[i] !== output[i]), [11, 22, 24]);
    assert.equal(input[22] - output[22], 1);
    const { layers } = inspectFrame(frame);
    assert.deepEqual(layers.map(({ label, length }) => [label, length]), [['Ethernet II', 14], ['IPv4', 20], ['UDP', 8], ['MPEG-TS', 1316]]);
    const { fields } = layers.at(-1);
    assert.deepEqual(fields.map(({ offset, length }) => [offset, length]), [[42, 1], [43, 2], [45, 1], [46, 184], [230, 1128]]);
    assert.deepEqual(fields.slice(0, 3).map(({ value }) => value), ['0x47', '0x0100（PID 256）', `0x1${cc}（计数器 ${cc}）`]);
    assert.deepEqual([...output.slice(34, 38)], [0x13, 0x88, 0x04, 0xd2]);
    for (let i = 0; i < 7; i++) assert.deepEqual([...output.slice(42 + i * 188, 46 + i * 188)], [0x47, 1, 0, 0x10 | ((cc + i) & 15)]);
  }
});
