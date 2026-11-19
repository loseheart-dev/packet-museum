import { concat, decode, empty, numberHex, Reader, requireBytes, size, uint } from './core.js';

const recordTypes = { 20: 'ChangeCipherSpec', 21: 'Alert', 22: 'Handshake', 23: 'Application Data' };
const messageTypes = { 1: 'ClientHello', 2: 'ServerHello', 8: 'EncryptedExtensions', 11: 'Certificate', 15: 'CertificateVerify', 20: 'Finished' };
const extensionTypes = { 0: 'server_name', 10: 'supported_groups', 13: 'signature_algorithms', 43: 'supported_versions', 51: 'key_share' };
const vector = (value, width) => concat(uint(value.length, width), value);

export const tlsRecord = ({ type, version = 0x0303, payload }) => concat(uint(type, 1), uint(version, 2), vector(payload, 2));
export const tlsHandshake = ({ type, body }) => concat(uint(type, 1), vector(body, 3));
export const tlsExtension = (type, data) => concat(uint(type, 2), vector(data, 2));

export function tlsHello({ server = false, version = 0x0303, random, session = empty, suites = [0x1301], extensions = [] }) {
  requireBytes(random.length === 32 && session.length <= 32 && suites.length && (!server || suites.length === 1), '无效的 TLS Hello 向量');
  const cipher = concat(...suites.map(suite => uint(suite, 2)));
  return tlsHandshake({ type: server ? 2 : 1, body: concat(uint(version, 2), random, vector(session, 1),
    server ? cipher : vector(cipher, 2), server ? uint(0, 1) : vector(uint(0, 1), 1), vector(concat(...extensions), 2)) });
}

function within(r, length, parse) {
  const offset = r.offset + r.pos;
  const nested = new Reader(r.read(length), offset, r.label, r.color);
  parse(nested);
  nested.end();
  r.fields.push(...nested.fields);
}

function parseExtension(r, type, server) {
  if (type === 43 || type === 10 || type === 13) {
    const chosen = server && type === 43;
    const length = chosen ? 2 : r.number('向量长度', type === 43 ? 1 : 2, size);
    requireBytes(length > 0 && length % 2 === 0 && length === r.rest(), 'TLS 扩展向量长度错误');
    const label = { 43: chosen ? '选中版本' : '支持版本', 10: '支持组', 13: '签名算法' }[type];
    for (let i = 0; i < length; i += 2) r.number(label, 2, numberHex);
  } else if (type === 51) {
    const entry = group => {
      group.number('密钥交换组', 2, numberHex);
      const length = group.number('公钥长度', 2, size);
      requireBytes(length > 0, 'TLS key_share 公钥为空');
      group.slice('公钥', length);
    };
    if (server) entry(r);
    else within(r, r.number('KeyShare 向量长度', 2, size), group => { while (group.rest()) entry(group); });
  } else if (type === 0 && !server) {
    within(r, r.number('服务器名称列表长度', 2, size), list => {
      while (list.rest()) {
        list.number('名称类型', 1);
        list.slice('服务器名称', list.number('名称长度', 2, size), decode);
      }
    });
  } else r.slice(extensionTypes[type] ?? '扩展数据', r.rest());
}

function parseHello(r, server) {
  r.number('legacy_version', 2, numberHex);
  r.slice('Random', 32);
  const idLength = r.number('会话 ID 长度', 1, size);
  requireBytes(idLength <= 32, 'TLS 会话 ID 超长');
  r.slice('会话 ID', idLength);
  const cipherLength = server ? 2 : r.number('密码套件长度', 2, size);
  requireBytes(cipherLength > 0 && cipherLength % 2 === 0, 'TLS 密码套件向量长度错误');
  for (let i = 0; i < cipherLength; i += 2) r.number('密码套件', 2, numberHex);
  const methods = server ? 1 : r.number('压缩方法长度', 1, size);
  requireBytes(methods > 0, 'TLS 缺少压缩方法');
  r.slice('压缩方法', methods);
  const ext = r.number('扩展总长度', 2, size);
  within(r, ext, group => {
    while (group.rest()) {
      const type = group.number('扩展类型', 2, n => extensionTypes[n] ?? numberHex(n));
      const length = group.number('扩展长度', 2, size);
      within(group, length, extension => parseExtension(extension, type, server));
    }
  });
}

export function parseHandshake(r) {
  while (r.rest()) {
    const type = r.number('握手类型', 1, n => messageTypes[n] ?? n);
    const length = r.number('握手长度', 3, size);
    if (type === 1 || type === 2) within(r, length, body => parseHello(body, type === 2));
    else r.slice('握手消息体', length);
  }
}

// shortcut: each fixture contains complete records and cleartext handshake messages, add reassembly only for a lesson that teaches fragmentation.
export function parseTLS(r) {
  while (r.rest()) {
    const type = r.number('记录类型', 1, n => recordTypes[n] ?? n);
    requireBytes(recordTypes[type], '无效的 TLS 记录类型');
    r.number('legacy_record_version', 2, numberHex);
    const length = r.number('记录长度', 2, size);
    requireBytes(length <= (1 << 14) + (type === 23 ? 256 : 0), 'TLS 记录超长');
    if (type === 22) within(r, length, parseHandshake);
    else r.slice(type === 23 ? '密文（含认证数据）' : '记录载荷', length, () => size(length));
  }
}
