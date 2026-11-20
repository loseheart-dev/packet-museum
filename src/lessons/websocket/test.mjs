import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { inspectFrame } from '../../lib/bytes/index.js';
import { checksum, transportChecksum } from '../../lib/bytes/core.js';
import lesson from './index.js';

const { frames } = lesson;
const layer = (frame, label) => inspectFrame(frame).layers.find(item => item.label === label);

test('使用请求密钥计算 WebSocket 握手响应', () => {
  const [request, response] = frames.slice(3, 5).map(frame => layer(frame, 'HTTP').fields.map(field => field.value));
  assert.equal(request[0], 'GET /chat HTTP/1.1');
  assert.equal(response[0], 'HTTP/1.1 101 Switching Protocols');
  for (const headers of [request, response]) {
    assert(headers.includes('Upgrade: websocket') && headers.includes('Connection: Upgrade'));
  }
  const key = request.find(line => line.startsWith('Sec-WebSocket-Key: ')).split(': ')[1];
  assert.equal(Buffer.from(key, 'base64').length, 16);
  const accept = createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');
  assert(response.includes(`Sec-WebSocket-Accept: ${accept}`));
  assert(!response.some(line => line.startsWith('Sec-WebSocket-Extensions:')));
});

test('WebSocket 帧按原站长度和字节编码，检查器还原掩码载荷', () => {
  assert.deepEqual(frames.map(frame => frame.bytes.length), [66, 66, 60, 547, 183, 65, 69, 60, 60, 62, 60]);
  const expected = ['818537fa213d7f9f4d5158', '810d626f623a206869207468657265', '8900', '8a805c1e9072', '8882a34b07d9a0a3', '880203e8'];
  for (const [i, frame] of frames.slice(5).entries()) {
    const { offset, length, fields } = layer(frame, 'WebSocket');
    assert.equal(Buffer.from(frame.bytes.subarray(offset, offset + length)).toString('hex'), expected[i]);
    assert.equal(fields[1].value.startsWith('已掩码'), frame.path[0] === 'client');
  }
  assert.equal(layer(frames[5], 'WebSocket').fields.at(-1).value, '"Hello" (5 B)');
  for (const frame of frames.slice(-2)) assert.equal(layer(frame, 'WebSocket').fields.at(-1).value, '1000（正常关闭）');
  for (const frame of frames) {
    const { src, dst } = inspectFrame(frame);
    const ip = layer(frame, 'IPv4');
    const end = ip.offset + frame.bytes[ip.offset + 2] * 256 + frame.bytes[ip.offset + 3];
    assert.equal(checksum(frame.bytes.subarray(ip.offset, ip.offset + ip.length)), 0);
    assert.equal(transportChecksum(src, dst, 6, frame.bytes.subarray(ip.offset + ip.length, end)), 0);
  }
});
