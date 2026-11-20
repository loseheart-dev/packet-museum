import { concat, ipv4Address, text, tlsExtension, uint } from '../../lib/bytes/index.js';
import { decode, hexText, ipText, numberHex, requireBytes, size } from '../../lib/bytes/core.js';

const cookie = 0x2112a442;
const cookieBytes = uint(cookie, 4);
const attributes = { 6: 'USERNAME', 8: 'MESSAGE-INTEGRITY', 32: 'XOR-MAPPED-ADDRESS', 36: 'PRIORITY', 0x8028: 'FINGERPRINT', 0x802a: 'ICE-CONTROLLING' };
const bindingTypes = { 1: 'Binding Request', 0x101: 'Binding Success Response' };
const handshakeTypes = { 1: 'Client Hello', 2: 'Server Hello', 11: 'Certificate', 12: 'Server Key Exchange', 13: 'Certificate Request', 14: 'Server Hello Done', 15: 'Certificate Verify', 16: 'Client Key Exchange' };
const profile = { 1: 'SRTP_AES128_CM_HMAC_SHA1_80', 7: 'SRTP_AEAD_AES_128_GCM' };
const suites = { 0xc02b: 'ECDHE-ECDSA-AES128-GCM-SHA256', 0xc02c: 'ECDHE-ECDSA-AES256-GCM-SHA384', 0xcca9: 'ECDHE-ECDSA-CHACHA20-POLY1305', 0xc009: 'ECDHE-ECDSA-AES128-CBC-SHA' };
const words = (...values) => concat(...values.map(value => uint(value, 2)));
const vector = (bytes, width) => concat(uint(bytes.length, width), bytes);
const padding = length => (4 - length % 4) % 4;

// shortcut: opaque bytes for the reference flights, not a cryptographic transcript; replace with a capture for verification/decryption.
export function sample(length, seed) {
  return Uint8Array.from({ length }, () => {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    return seed & 255;
  });
}

function fingerprint(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (~crc ^ 0x5354554e) >>> 0;
}

export function stun({ response, ice, address, port }) {
  const tid = Uint8Array.of(...(ice ? [8, 123, 210, 69, 145, 60, 174, 96, 23, 245, 43, 201] : [78, 33, 156, 7, 179, 90, 17, 232, 98, 13, 159, 52]));
  const attr = (type, bytes) => concat(words(type, bytes.length), bytes, new Uint8Array(padding(bytes.length)));
  const attrs = response ? attr(32, concat(Uint8Array.of(0, 1), uint(port ^ (cookie >>> 16), 2), ipv4Address(address).map((b, i) => b ^ cookieBytes[i])))
    : ice ? concat(attr(6, text('q7Rz:Hk2w')), attr(36, uint(1853824767, 4)), attr(0x802a, sample(8, 19))) : new Uint8Array();
  const body = ice ? concat(attrs, attr(8, sample(20, response ? 23 : 29))) : attrs;
  const message = concat(words(response ? 0x101 : 1, body.length + (ice ? 8 : 0)), cookieBytes, tid, body);
  return ice ? concat(message, attr(0x8028, uint(fingerprint(message), 4))) : message;
}

export function parseSTUN(r) {
  const type = r.number('消息类型', 2, n => `${numberHex(n)} · ${bindingTypes[n] ?? n}`);
  const length = r.number('消息长度', 2, size);
  requireBytes(bindingTypes[type] && length === r.bytes.length - 20 && length % 4 === 0, '无效的 STUN 消息类型或长度');
  requireBytes(r.number('Magic Cookie', 4, n => numberHex(n, 8)) === cookie, '无效的 STUN Magic Cookie');
  r.slice('事务 ID', 12);
  while (r.rest()) {
    const start = r.pos;
    const kind = r.number('属性类型', 2, n => `${attributes[n] ?? n} · ${numberHex(n)}`);
    const length = r.number('属性长度', 2, size);
    if (kind === 32) {
      requireBytes(length === 8 && r.number('保留', 1) === 0 && r.number('地址族', 1, n => n === 1 ? 'IPv4' : n) === 1, '无效的 STUN IPv4 映射地址');
      r.number('XOR 端口', 2, n => n ^ (cookie >>> 16));
      r.slice('XOR 映射地址', 4, b => ipText(b.map((n, i) => n ^ cookieBytes[i])));
    } else if (kind === 0x8028) {
      requireBytes(length === 4 && r.rest() === 4 && r.number('FINGERPRINT', 4, n => numberHex(n, 8)) === fingerprint(r.bytes.subarray(0, start)), '无效的 STUN FINGERPRINT');
    } else r.slice(attributes[kind] ?? '属性值', length, kind === 6 ? decode : kind === 36 ? b => b.reduce((n, byte) => 256 * n + byte, 0) : hexText);
    r.slice('填充', padding(length));
  }
}

function dtlsHello(server, length) {
  const useSrtp = tlsExtension(14, concat(vector(server ? words(7) : words(7, 1), 2), uint(0, 1)));
  const points = tlsExtension(11, Uint8Array.of(1, 0));
  const ems = tlsExtension(23, new Uint8Array());
  const body = concat(words(0xfefd), sample(32, server ? 52 : 43), vector(sample(server ? 29 : 0, 6), 1),
    server ? words(0xc02b) : concat(uint(0, 1), vector(words(0xc02b, 0xc02c, 0xcca9, 0xc009), 2)), server ? uint(0, 1) : Uint8Array.of(1, 0));
  const extensions = server ? concat(useSrtp, points, ems) : concat(
    tlsExtension(10, vector(words(29, 23), 2)), tlsExtension(13, vector(words(0x0403, 0x0503), 2)), points, useSrtp, ems);
  const pad = length - body.length - 2 - extensions.length;
  return concat(body, vector(pad ? concat(extensions, tlsExtension(21, new Uint8Array(pad - 4))) : extensions, 2));
}

export function dtls(records) {
  return concat(...records.map(([type, sequence, message, length], i) => {
    const epoch = type === 'finished' ? 1 : 0;
    const body = type === 'ccs' ? uint(1, 1) : epoch ? sample(length, 62) : concat(uint(type, 1), uint(length, 3),
      uint(message, 2), uint(0, 3), uint(length, 3), type === 1 || type === 2 ? dtlsHello(type === 2, length) : sample(length, 73 + i));
    return concat(uint(type === 'ccs' ? 20 : 22, 1), words(0xfefd, epoch), uint(sequence, 6), vector(body, 2));
  }));
}

function readHello(r, server, end) {
  r.number('版本', 2, numberHex);
  r.slice('随机数', 32);
  r.slice('会话 ID', r.number('会话 ID 长度', 1));
  if (!server) r.slice('Cookie', r.number('Cookie 长度', 1));
  const cipherLength = server ? 2 : r.number('密码套件长度', 2);
  requireBytes(cipherLength >= 2 && cipherLength % 2 === 0, '无效的 DTLS 密码套件长度');
  for (let i = 0; i < cipherLength; i += 2) r.number('密码套件', 2, n => suites[n] ?? numberHex(n));
  r.slice('压缩方法', server ? 1 : r.number('压缩方法长度', 1));
  const length = r.number('扩展总长度', 2);
  requireBytes(r.pos + length === end, '无效的 DTLS Hello 扩展长度');
  while (r.pos < end) {
    const kind = r.number('扩展类型', 2, n => ({ 10: 'supported_groups', 11: 'ec_point_formats', 13: 'signature_algorithms', 14: 'use_srtp', 21: 'padding', 23: 'extended_master_secret' })[n] ?? numberHex(n));
    const length = r.number('扩展长度', 2, size);
    const stop = r.pos + length;
    requireBytes(stop <= end, 'DTLS 扩展越界');
    if (kind !== 14) r.slice('扩展内容', length);
    else {
      const profiles = r.number('SRTP 保护配置列表长度', 2);
      requireBytes(profiles >= 2 && profiles % 2 === 0 && r.pos + profiles < stop, '无效的 SRTP 保护配置列表');
      for (let i = 0; i < profiles; i += 2) r.number('SRTP 保护配置', 2, n => profile[n] ?? numberHex(n));
      r.slice('SRTP MKI', r.number('SRTP MKI 长度', 1));
      requireBytes(r.pos === stop, '无效的 use_srtp 扩展长度');
    }
  }
}

// shortcut: DTLS 1.2 with one complete message per record; extend for fragmented/coalesced handshake messages.
export function parseDTLS(r) {
  while (r.rest()) {
    const type = r.number('内容类型', 1, n => n === 20 ? '20 (Change Cipher Spec)' : n === 22 ? '22 (Handshake)' : n);
    requireBytes(r.number('版本', 2, n => `${numberHex(n)} (DTLS 1.2)`) === 0xfefd, '无效的 DTLS 版本');
    const epoch = r.number('纪元', 2);
    r.number('记录序号', 6);
    const length = r.number('记录长度', 2, size);
    const end = r.pos + length;
    requireBytes(end <= r.bytes.length && (type === 20 || type === 22), '无效的 DTLS 记录');
    if (epoch) r.slice('Finished（加密）', length, b => size(b.length));
    else if (type === 20) requireBytes(length === 1 && r.number('Change Cipher Spec', 1) === 1, '无效的 DTLS Change Cipher Spec');
    else {
      const message = r.number('握手类型', 1, n => `${n} (${handshakeTypes[n] ?? n})`);
      const body = r.number('消息长度', 3, size);
      r.number('消息序号', 2);
      const fragmentOffset = r.number('分片偏移', 3);
      const fragmentLength = r.number('分片长度', 3, size);
      requireBytes(fragmentOffset === 0 && fragmentLength === body && r.pos + body === end, '无效或不完整的 DTLS 握手消息');
      if (message === 1 || message === 2) readHello(r, message === 2, end);
      else r.slice('握手消息体', body, b => size(b.length));
    }
  }
}

export function srtp({ marker, pt, seq, ts, ssrc, level, sent, tw, media }) {
  const primary = sent === undefined ? Uint8Array.of(0x10, 0x80 | level) : concat(uint(0x22, 1), uint(sent, 3));
  return concat(Uint8Array.of(0x90, (marker ? 0x80 : 0) | pt), uint(seq, 2), uint(ts, 4), uint(ssrc, 4), words(0xbede, 2),
    primary, uint(0x31, 1), uint(tw, 2), new Uint8Array(5 - primary.length), sample(media, seq), sample(16, ssrc ^ seq));
}

// shortcut: one-byte RTP extensions and a 16-byte GCM tag only; extend if another SRTP profile is needed.
export function parseSRTP(r) {
  requireBytes(r.number('版本等', 1, () => '2，无填充，有扩展，无 CSRC') === 0x90, '无效的示例 RTP 头部');
  r.number('标记位、载荷类型', 1, n => `${n >>> 7}，${n & 127}（${(n & 127) === 111 ? 'Opus' : 'VP8'}，按 SDP 中的约定）`);
  r.number('序列号', 2);
  r.number('时间戳', 4);
  r.number('SSRC', 4, n => numberHex(n, 8));
  requireBytes(r.number('头部扩展类型', 2, numberHex) === 0xbede, '无效的 RTP 头部扩展');
  const words = r.number('头部扩展长度', 2, n => `${n} 个字`);
  const end = r.pos + words * 4;
  requireBytes(end + 16 < r.bytes.length, 'SRTP 缺少媒体或认证标签');
  while (r.pos < end) {
    if (r.bytes[r.pos] === 0) { r.number('填充', 1); continue; }
    const header = r.number('扩展元素', 1, n => `ID ${n >>> 4} · ${(n & 15) + 1} B`);
    const id = header >>> 4, length = (header & 15) + 1;
    requireBytes(id > 0 && id < 15 && r.pos + length <= end, '无效的 RTP 扩展元素');
    if (id === 1) r.number('音频电平', length, n => `−${n & 127} dBov${n & 128 ? '，有语音' : ''}`);
    else if (id === 2) r.number('绝对发送时间', length);
    else if (id === 3) r.number('传输序号', length);
    else r.slice('扩展值', length);
  }
  r.slice('加密的媒体', r.rest() - 16, b => size(b.length));
  r.slice('认证标签', 16, b => size(b.length));
}
