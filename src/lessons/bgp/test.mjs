import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectFrame } from '../../lib/bytes/index.js';
import { transportChecksum } from '../../lib/bytes/core.js';
import lesson from './index.js';

test('BGP 教学帧保留原站长度、邻接与路由通告字节', () => {
  assert.equal(lesson.steps.length, 8);
  assert.deepEqual(lesson.frames.map(frame => frame.bytes.length), [74, 74, 66, 111, 111, 85, 85, 113, 117, 66, 66, 93, 93]);
  const bgp = [];
  for (const frame of lesson.frames) {
    const { layers } = inspectFrame(frame);
    const ip = layers.find(layer => layer.label === 'IPv4');
    const tcp = layers.find(layer => layer.label === 'TCP');
    const peering = !frame.id.startsWith('web-');
    assert.equal(frame.bytes[ip.offset + 8], peering ? 1 : frame.id === 'web-syn' ? 128 : 52);
    const t = new DataView(frame.bytes.buffer, frame.bytes.byteOffset + tcp.offset, tcp.length);
    const port = frame.path.includes('hosting') ? 41622 : 50311;
    const expected = peering ? [179, port] : [443, 52800];
    assert.deepEqual([t.getUint16(0), t.getUint16(2)].sort((a, b) => a - b), expected);
    if (frame.protocol !== 'BGP') continue;
    assert.match(layers.at(-1).label, /^BGP · /);
    const message = frame.bytes.subarray(tcp.offset + tcp.length);
    assert(message.subarray(0, 16).every(byte => byte === 255));
    assert.equal(new DataView(message.buffer, message.byteOffset).getUint16(16), message.length);
    bgp.push(Buffer.from(message.subarray(18)).toString('hex'));
  }
  assert.deepEqual(bgp, [
    '0104fbf400b4c000020510020e010400010001020041040000fbf4',
    '0104fbfe00b4c000020410020e010400010001020041040000fbfe',
    '04', '04',
    '02000000144001010040020602010000fbff400304c000020918cb0071',
    '02000000184001010040020a02020000fbfe0000fbff400304c000020418cb0071',
    '02000418cb00710000', '02000418cb00710000',
  ]);
});

test('BGP 检查器用整帧偏移标出能力、路径和前缀', () => {
  const cases = [
    ['isp-open', '多协议', 'IPv4 unicast', 97, 6],
    ['isp-open', '路由刷新', '是', 103, 2],
    ['transit-open', '4 字节 AS 号', '是，AS 64510', 105, 6],
    ['isp-keepalive', '类型', '4 (KEEPALIVE)', 84, 1],
    ['announce', 'AS_PATH', '64511', 93, 9],
    ['forward', 'AS_PATH', '64510 64511', 93, 13],
    ['forward', 'NEXT_HOP', '192.0.2.4', 106, 7],
    ['forward', '可达', '203.0.113.0/24', 113, 4],
    ['withdraw', '已撤销', '203.0.113.0/24', 87, 4],
  ];
  for (const [id, label, value, offset, length] of cases) {
    const { layers } = inspectFrame(lesson.frames.find(frame => frame.id === id));
    assert.deepEqual(layers.at(-1).fields.find(field => field.label === label), { label, value, offset, length });
  }
});

test('BGP 检查器拒绝错误的消息与区段长度', () => {
  for (const [id, offset, value, error] of [
    ['isp-open', 66, 0, /标记无效/],
    ['isp-open', 83, 44, /消息长度/],
    ['isp-open', 96, 13, /缺少/],
    ['forward', 88, 23, /缺少/],
    ['withdraw', 87, 33, /前缀长度无效/],
  ]) {
    const frame = lesson.frames.find(frame => frame.id === id);
    const { src, dst, layers: [, , tcp] } = inspectFrame(frame);
    const bytes = frame.bytes.slice();
    bytes[offset] = value;
    const segment = bytes.subarray(tcp.offset);
    const header = new DataView(segment.buffer, segment.byteOffset);
    header.setUint16(16, 0);
    header.setUint16(16, transportChecksum(src, dst, 6, segment));
    assert.throws(() => inspectFrame({ ...frame, bytes }), error);
  }
});
