import test from 'node:test';
import assert from 'node:assert/strict';
import { arp, concat, dhcp, dns, ethernet, http, inspectFrame, ipv4, macAddress, reassembleTCP, tcp, text, tlsExtension, tlsHello, tlsRecord, udp, uint } from '../src/lib/bytes/index.js';

const addresses = { src: '192.0.2.10', dst: '203.0.113.22' };
const mac = '02:4d:00:00:00:2c';
const inspect = (format, bytes) => inspectFrame({ format, bytes }).layers[0];

test('以太网/ARP 的 14 + 28 字节与 IPv4/UDP 教学基准校验和', () => {
  const payload = arp({ operation: 1, senderMac: mac, senderIp: addresses.src, targetIp: addresses.dst });
  const bytes = ethernet({ src: mac, dst: 'ff:ff:ff:ff:ff:ff', type: 0x0806, payload });
  assert.deepEqual(inspectFrame({ bytes }).layers.map(layer => layer.length), [14, 28]);
  const padded = ethernet({ src: mac, dst: 'ff:ff:ff:ff:ff:ff', type: 0x0806, payload, pad: true });
  const decoded = inspectFrame({ bytes: padded });
  assert.deepEqual(decoded.link, { src: mac, dst: 'ff:ff:ff:ff:ff:ff' });
  assert.deepEqual(decoded.layers.map(layer => layer.length), [14, 28, 18]);
  assert.equal(decoded.layers.at(-1).fields[0].offset, 42);
  const datagram = udp({ ...addresses, srcPort: 40000, dstPort: 9000, payload: text('T=21') });
  const packet = ipv4({ ...addresses, id: 0x2b7c, protocol: 17, ttl: 64, payload: datagram });
  assert.equal(packet[10] * 256 + packet[11], 0x1130);
  const frame = { format: 'ipv4', bytes: packet };
  assert.deepEqual(inspectFrame(frame).layers.map(layer => layer.length), [20, 8, 4]);
  packet[8]--;
  assert.throws(() => inspectFrame(frame), /IPv4.*校验和/);
  packet[8]++;
  packet[31] ^= 1;
  assert.throws(() => inspectFrame(frame), /UDP.*校验和/);
});

test('TCP 选项有独立字节范围，最小帧填充不参与 TCP 校验', () => {
  const options = Uint8Array.of(2, 4, 5, 180, 3, 3, 7, 4, 2, 8, 10, 0, 0, 0, 11, 0, 0, 0, 13, 5, 10, 0, 0, 0, 21, 0, 0, 0, 31, 0, 0, 0);
  const segment = more => tcp({ ...addresses, srcPort: 52, dstPort: 80, ...more });
  const frame = ethernet({ src: mac, dst: mac, pad: true, payload: ipv4({ ...addresses, protocol: 6, payload: segment({}) }) });
  assert.deepEqual(inspectFrame({ bytes: frame }).layers.map(layer => layer.length), [14, 20, 20, 6]);
  const [{ fields }] = inspectFrame({ bytes: segment({ options, seq: 52 }), format: 'tcp', addresses, relativeTo: [50, null] }).layers;
  assert.equal(fields[2].value, '2（相对） · 52（绝对）');
  assert.deepEqual(fields.slice(9, 14).map(({ label, value }) => [label, value]), [['MSS', '1460 B'], ['窗口缩放', 'shift 7 · ×128'], ['SACK Permitted', '允许'], ['时间戳', 'TSval 11 · TSecr 13'], ['SACK', '[21, 31)']]);
  options[1] = 40;
  assert.throws(() => inspectFrame({ bytes: segment({ options }), format: 'tcp', addresses }), /选项长度/);
});

test('按同向连续序号重组实际 TCP 载荷，包括 32 位回绕', () => {
  const bytes = http({ startLine: 'HTTP/1.1 200 OK', body: 'OK\n' });
  const segment = (seq, payload) => {
    const bytes = tcp({ ...addresses, srcPort: 80, dstPort: 52000, seq, payload });
    return { bytes, ...inspectFrame({ bytes, format: 'tcp', addresses }) };
  };
  const a = segment(0xfffffff0, bytes.subarray(0, 16)), b = segment(0, bytes.subarray(16));
  assert.deepEqual(reassembleTCP([a, b], 'http').bytes, bytes);
  assert.throws(() => reassembleTCP([b, a], 'http'), /序号连续/);
});

test('TCP 数据偏移、奇数字节载荷和伪首部校验', () => {
  const bytes = tcp({ ...addresses, srcPort: 52000, dstPort: 80, flags: 0x18, seq: 1001, ack: 7001, options: uint(0x01010101, 4), payload: text('OK\n') });
  assert.deepEqual(inspectFrame({ bytes, format: 'tcp', addresses }).layers.map(layer => layer.length), [24, 3]);
  assert.throws(() => inspectFrame({ bytes, format: 'tcp', addresses: { ...addresses, dst: addresses.src } }), /TCP.*校验和/);
  assert.throws(() => inspectFrame({ bytes: bytes.subarray(0, 19), format: 'tcp', addresses }), /缺少/);
});

test('DNS 压缩指针以消息为基准，并拒绝自指针', () => {
  const bytes = dns({ id: 0x4c21, flags: 0x8180, questions: [{ name: 'lab.example' }], answers: [{ name: 'lab.example', type: 'A', ttl: 60, data: '203.0.113.42' }] });
  assert.deepEqual([...bytes.subarray(29, 31)], [192, 12]);
  assert.deepEqual(inspect('dns', bytes).fields.at(-1), { label: 'A 地址', offset: 41, length: 4, value: '203.0.113.42' });
  bytes[30] = 29;
  assert.throws(() => inspect('dns', bytes), /压缩指针/);
});

test('DHCP TLV 记录范围并拒绝截断和缺失结束标记', () => {
  const bytes = dhcp({ op: 2, xid: 0x196745ab, mac, yiaddr: '192.0.2.44', options: [[53, 5], [51, 3600], [1, '255.255.255.0']] });
  const fields = inspect('dhcp', bytes).fields;
  assert.equal(fields.find(field => field.label === '消息类型').value, 'ACK');
  assert.equal(fields.find(field => field.label === '租期').value, '3600 s');
  assert.throws(() => inspect('dhcp', bytes.subarray(0, 241)), /缺少/);
  assert.throws(() => inspect('dhcp', bytes.subarray(0, -1)), /结束标记/);
});

test('DHCP 类型化显示客户端选项、续租计时与 DNS 格式 FQDN', () => {
  const bytes = dhcp({ xid: 1, mac, options: [[12, 'demo'], [28, '192.0.2.255'], [55, Uint8Array.of(1, 3)],
    [58, 43200], [59, 75600], [60, 'class'], [61, concat(uint(1, 1), macAddress(mac))], [81, concat(Uint8Array.of(4, 0, 0, 4), text('demo'), uint(0, 1))]] });
  const fields = inspect('dhcp', bytes).fields;
  for (const [label, value] of [['主机名', 'demo'], ['广播地址', '192.0.2.255'], ['参数请求列表', '1 子网掩码 · 3 网关'], ['续租时间 T1', '43200 s'], ['重绑定时间 T2', '75600 s'], ['厂商类别', 'class'], ['客户端标识', mac], ['客户端 FQDN', 'demo']]) assert.equal(fields.find(field => field.label === label).value, value);
  bytes[bytes.length - 2] = 5;
  assert.throws(() => inspect('dhcp', bytes), /DHCP FQDN/);
});

test('HTTP 用实际编码后的字节数和 CRLF 划分正文', () => {
  const request = http({ startLine: 'GET /status HTTP/1.1', headers: [['Host', 'lab.example']] });
  const response = http({ startLine: 'HTTP/1.1 200 OK', body: 'OK\n' });
  assert.equal(inspect('http', request).length, 43);
  assert.deepEqual(inspect('http', response).fields.at(-1), { label: '正文', offset: 38, length: 3, value: 'OK\n' });
  assert.throws(() => inspect('http', response.subarray(0, -1)), /Content-Length/);
});

test('TLS Hello、记录边界、不可解码密文及截断', () => {
  const publicKey = concat(uint(0x001d, 2), uint(32, 2), new Uint8Array(32).fill(1));
  const payload = tlsHello({ random: new Uint8Array(32), extensions: [
    tlsExtension(43, concat(uint(2, 1), uint(0x0304, 2))),
    tlsExtension(51, concat(uint(publicKey.length, 2), publicKey)),
  ] });
  const clear = tlsRecord({ type: 22, payload });
  const bytes = concat(clear, tlsRecord({ type: 23, payload: new Uint8Array(32) }));
  const fields = inspect('tls', bytes).fields;
  assert.equal(fields.find(field => field.label === '支持版本').value, '0x0304');
  assert.equal(fields.find(field => field.label === '公钥').length, 32);
  assert.equal(fields.at(-1).offset, clear.length + 5);
  assert.equal(fields.at(-1).label, '密文（含认证数据）');
  assert.equal(inspectFrame({ bytes, format: 'tls', fieldNames: { 公钥: '密钥共享' } }).layers[0].fields.find(field => field.label === '密钥共享').length, 32);
  assert.throws(() => inspect('tls', bytes.subarray(0, -1)), /缺少/);
  assert.throws(() => inspect('tls', tlsRecord({ type: 22, payload: new Uint8Array(16385) })), /超长/);
});
