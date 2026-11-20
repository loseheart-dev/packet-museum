import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectFrame } from '../../lib/bytes/index.js';
import { frames, linkLocal, router } from './frames.js';

test('IPv6 邻居发现的原站帧长度、协议字段和校验和', () => {
  assert.deepEqual(frames.map(frame => frame.bytes.length), [78, 70, 142, 78, 86, 86]);
  assert.deepEqual(frames.map(frame => frame.bytes[54]), [135, 133, 134, 135, 135, 136]);
  const decoded = frames.map(inspectFrame);
  assert.deepEqual(decoded.map(frame => frame.link.dst), [
    '33:33:ff:b0:7c:13', '33:33:00:00:00:02', '33:33:00:00:00:01',
    '33:33:ff:b0:7c:13', '33:33:ff:b0:7c:13', '00:00:5e:00:53:01',
  ]);
  const multicast = 'ff02::1:ffb0:7c13';
  assert.deepEqual(decoded.map(({ src, dst }) => [src, dst]), [
    ['::', multicast], [linkLocal, 'ff02::2'], [router, 'ff02::1'], ['::', multicast], [router, multicast], [linkLocal, router],
  ]);
  for (const [i, frame] of frames.entries()) {
    const { bytes } = frame, { layers } = decoded[i];
    assert.deepEqual(layers.map(layer => layer.label), ['Ethernet II', 'IPv6', 'ICMPv6']);
    assert.deepEqual(layers.map(layer => layer.length), [14, 40, bytes.length - 54]);
    let offset = 0;
    for (const field of layers.flatMap(layer => layer.fields)) {
      assert.equal(field.offset, offset);
      offset += field.length;
    }
    assert.equal(offset, bytes.length);
    let sum = bytes.length - 54 + 58;
    for (let i = 22; i < bytes.length; i += 2) sum += bytes[i] * 256 + bytes[i + 1];
    assert.equal(sum % 65535, 0);

    const corrupt = bytes.slice();
    corrupt[23] ^= 1;
    assert.throws(() => inspectFrame({ ...frame, bytes: corrupt }), /伪首部校验和错误/);
  }
  const ra = decoded[2].layers[2].fields;
  assert.deepEqual(ra.slice(-4).map(({ value }) => value), [
    '00:00:5e:00:53:01', '1500 B', '2001:db8:1234:5678::/64，有效期 86,400 s，首选期 14,400 s',
    '2001:4860:4860::8888，有效 3,600 s',
  ]);
  const target = '2001:db8:1234:5678:8d2e:4f61:a9b0:7c13';
  for (const i of [3, 4, 5]) {
    assert(frames[i].summary.includes(target));
    assert.equal(decoded[i].layers[2].fields.find(field => field.label === '目标').value, target);
  }
});
