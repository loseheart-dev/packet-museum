import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectFrame } from '../../lib/bytes/index.js';
import lesson from './index.js';

test('DHCP DORA and renewal match the reference frames', () => {
  const client = '192.168.1.10', router = '192.168.1.1', zero = '0.0.0.0', broadcast = '255.255.255.255';
  const clientMac = '00:00:5e:00:53:10', routerMac = '00:00:5e:00:53:01';
  assert.deepEqual(lesson.frames.map(frame => frame.bytes.length), [342, 342, 364, 342, 352, 342]);
  assert.deepEqual(lesson.steps.map(step => step.frames?.length ?? 0), [0, 1, 1, 1, 1, 2]);
  assert.deepEqual(lesson.steps[4].nodeUpdates.client, { address: client, after: 'dhcp-4' });
  const offerOptions = [53, 54, 51, 58, 59, 1, 28, 3, 6];
  const options = [[53, 61, 12, 60, 55], offerOptions, [53, 61, 50, 54, 12, 81, 60, 55], offerOptions, [53, 61, 12, 81, 60, 55], offerOptions];
  for (const [i, frame] of lesson.frames.entries()) {
    const reply = i % 2 === 1, renew = i >= 4;
    const { layers, src, dst } = inspectFrame(frame);
    assert.deepEqual([src, dst], [reply ? router : renew ? client : zero, reply ? client : renew ? router : broadcast]);
    const [ethernet, ip, udp, bootp] = layers.map(layer => Object.fromEntries(layer.fields.map(field => [field.offset - layer.offset, field.value])));
    assert.deepEqual([ethernet[0], ethernet[6]], [reply ? clientMac : renew ? routerMac : 'ff:ff:ff:ff:ff:ff', reply ? routerMac : clientMac]);
    assert.equal(Number(ip[8]), reply ? 64 : 128);
    assert.deepEqual([Number(udp[0]), Number(udp[2])], reply ? [67, 68] : [68, 67]);
    assert.deepEqual([Number(bootp[0]), bootp[4], Number(bootp[10]), bootp[12], bootp[16], bootp[28], bootp[242]],
      [reply ? 2 : 1, renew ? '0x7a1c22e5' : '0x3903f326', 0, renew ? client : zero, reply ? client : zero, clientMac, ['Discover', 'Offer', 'Request', 'ACK', 'Request', 'ACK'][i]]);
    assert.deepEqual(layers[3].fields.filter(field => field.label === '选项' && !field.value.startsWith('255')).map(field => Number.parseInt(field.value)), options[i]);
    const decoded = Object.fromEntries(layers[3].fields.map(field => [field.label, field.value]));
    if (reply) assert.deepEqual([decoded['服务器标识'], decoded['租期'], decoded['子网掩码'], decoded['网关'], decoded['DNS 服务器']], [router, '86400 s', '255.255.255.0', router, '8.8.8.8']);
    if (i === 2) assert.deepEqual([decoded['请求地址'], decoded['服务器标识']], [client, router]);
  }
});
