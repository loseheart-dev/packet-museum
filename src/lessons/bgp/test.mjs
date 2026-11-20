import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectFrame } from '../../lib/bytes/index.js';
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
