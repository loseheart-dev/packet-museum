import { concat, decode, empty, ipv4Address, ipText, macAddress, macText, numberHex, requireBytes, size, text, uint } from './core.js';

const cookie = 0x63825363;
const dhcpNames = { 1: '子网掩码', 3: '网关', 6: 'DNS 服务器', 12: '主机名', 28: '广播地址', 50: '请求地址', 51: '租期', 53: '消息类型', 54: '服务器标识', 55: '参数请求列表', 58: '续租时间 T1', 59: '重绑定时间 T2', 60: '厂商类别', 61: '客户端标识', 81: '客户端 FQDN' };
const dhcpTimers = [51, 58, 59];
const dhcpMessages = { 1: 'Discover', 2: 'Offer', 3: 'Request', 4: 'Decline', 5: 'ACK', 6: 'NAK', 7: 'Release', 8: 'Inform' };

export function dhcp({ op = 1, xid, mac, flags = 0x8000, secs = 0, hops = 0, ciaddr = '0.0.0.0', yiaddr = '0.0.0.0', siaddr = '0.0.0.0', giaddr = '0.0.0.0', options }) {
  return concat(uint(op, 1), uint(1, 1), uint(6, 1), uint(hops, 1), uint(xid, 4), uint(secs, 2), uint(flags, 2),
    ...[ciaddr, yiaddr, siaddr, giaddr].map(ipv4Address), macAddress(mac), new Uint8Array(10 + 64 + 128), uint(cookie, 4),
    ...options.map(([code, value]) => {
      requireBytes(code > 0 && code < 255, 'DHCP 选项 0/255 由构造器处理');
      const bytes = typeof value === 'string' ? ([12, 60].includes(code) ? text(value) : ipv4Address(value)) : typeof value === 'number' ? uint(value, dhcpTimers.includes(code) ? 4 : 1) : value;
      return concat(uint(code, 1), uint(bytes.length, 1), bytes);
    }), uint(255, 1));
}

export function parseDHCP(r) {
  r.number('操作', 1);
  const hw = r.number('硬件类型', 1);
  const len = r.number('硬件地址长度', 1);
  requireBytes(hw === 1 && len === 6, '只支持以太网 DHCP');
  r.number('跳数', 1); r.number('事务 ID', 4, n => numberHex(n, 8)); r.number('经过秒数', 2); r.number('标志', 2, numberHex);
  for (const label of ['ciaddr · 客户端地址', 'yiaddr · 分配地址', 'siaddr · 启动服务器', 'giaddr · 中继地址']) r.slice(label, 4, ipText);
  r.slice('客户端 MAC', len, macText); r.slice('地址填充', 16 - len);
  r.slice('服务器名', 64, b => decode(b).split('\0')[0] || '—');
  r.slice('启动文件', 128, b => decode(b).split('\0')[0] || '—');
  requireBytes(r.number('Magic Cookie', 4, n => numberHex(n, 8)) === cookie, 'DHCP Magic Cookie 错误');
  let ended = false;
  while (r.rest()) {
    const code = r.number(ended ? '填充' : '选项', 1, n => n === 255 ? '255 · 结束' : n === 0 ? '0 · 填充' : `${n} · ${dhcpNames[n] ?? '未知'}`);
    requireBytes(!ended || code === 0, 'DHCP 结束标记之后只能有填充');
    if (code === 255) ended = true;
    if (!code || code === 255) continue;
    const length = r.number('选项长度', 1, size);
    if (code === 53 || dhcpTimers.includes(code)) {
      requireBytes(length === (code === 53 ? 1 : 4), 'DHCP 选项长度错误');
      r.number(dhcpNames[code], length, n => code === 53 ? dhcpMessages[n] ?? n : `${n} s`);
    } else if ([1, 3, 6, 28, 50, 54].includes(code)) {
      requireBytes(length > 0 && ([3, 6].includes(code) ? length % 4 === 0 : length === 4), 'DHCP IPv4 选项长度错误');
      for (let i = 0; i < length; i += 4) r.slice(dhcpNames[code], 4, ipText);
    } else if ([12, 60].includes(code)) r.slice(dhcpNames[code], length, decode);
    else if (code === 55) r.slice(dhcpNames[code], length, b => Array.from(b, n => `${n}${dhcpNames[n] ? ` ${dhcpNames[n]}` : ''}`).join(' · '));
    else if (code === 61) {
      requireBytes(length >= 2, 'DHCP 客户端标识长度错误');
      const type = r.number('客户端标识类型', 1);
      r.slice(dhcpNames[code], length - 1, type === 1 && length === 7 ? macText : undefined);
    } else if (code === 81) {
      requireBytes(length >= 3, 'DHCP FQDN 选项长度错误');
      const flags = r.number('FQDN 标志', 1, n => `S=${n & 1} O=${n >> 1 & 1} E=${n >> 2 & 1} N=${n >> 3 & 1}`);
      r.number('FQDN RCODE1', 1); r.number('FQDN RCODE2', 1);
      r.slice(dhcpNames[code], length - 3, flags & 4 ? fqdn : decode);
    } else r.slice('选项数据', length);
  }
  requireBytes(ended, 'DHCP 缺少结束标记');
}

function fqdn(bytes) {
  const labels = [];
  let i = 0;
  while (i < bytes.length) {
    const length = bytes[i++];
    if (!length && i === bytes.length) return labels.join('.') || '.';
    requireBytes(length > 0 && length <= 63 && i + length < bytes.length, '无效的 DHCP FQDN 标签');
    labels.push(decode(bytes.subarray(i, i += length)));
  }
  throw new RangeError('DHCP FQDN 缺少末尾根标签');
}

export function http({ startLine, headers = [], body = empty }) {
  const content = typeof body === 'string' ? text(body) : body;
  requireBytes(/^[^\r\n]+$/.test(startLine) && headers.every(([name, value]) => /^[!#$%&'*+.^_`|~\w-]+$/.test(name) && !/[\r\n]/.test(value)), '无效的 HTTP 首部');
  const entries = content.length && !headers.some(([name]) => name.toLowerCase() === 'content-length') ? [...headers, ['Content-Length', content.length]] : headers;
  return concat(text(`${startLine}\r\n${entries.map(([name, value]) => `${name}: ${value}\r\n`).join('')}\r\n`), content);
}

// shortcut: accepts complete fixed-length teaching messages only, extend when a lesson needs streaming framing.
export function parseHTTP(r) {
  const lines = () => {
    const start = r.pos;
    for (let i = start; i + 1 < r.bytes.length; i++) {
      if (r.bytes[i] === 13 && r.bytes[i + 1] === 10) return i - start;
      if (r.bytes[i] === 13 || r.bytes[i] === 10) break;
    }
    throw new RangeError('HTTP 缺少 CRLF');
  };
  const length = lines();
  const first = decode(r.slice('起始行', length + 2, b => decode(b).trimEnd())).slice(0, -2);
  const request = /^[A-Z]+ \S+ HTTP\/1\.1$/.test(first);
  requireBytes(request || /^HTTP\/1\.1 \d{3}(?: .*)?$/.test(first), '无效的 HTTP/1.1 起始行');
  let contentLength, host = false;
  for (let n = lines(); n !== 0; n = lines()) {
    const line = decode(r.slice('首部行', n + 2, b => decode(b).trimEnd())).slice(0, -2);
    const match = /^([!#$%&'*+.^_`|~\w-]+):[ \t]*(.*)$/.exec(line);
    requireBytes(match, '无效的 HTTP 首部行');
    const [, name, value] = match;
    if (name.toLowerCase() === 'host') host = value.trim().length > 0;
    if (name.toLowerCase() === 'content-length') {
      requireBytes(/^\d+$/.test(value.trim()) && contentLength === undefined, '无效的 HTTP Content-Length');
      contentLength = Number(value);
    }
    requireBytes(name.toLowerCase() !== 'transfer-encoding', '教具不解析 HTTP Transfer-Encoding');
  }
  requireBytes(!request || host, 'HTTP/1.1 请求缺少 Host');
  r.slice('首部结束', 2);
  if (request || contentLength !== undefined) requireBytes((contentLength ?? 0) === r.rest(), 'HTTP 正文长度与 Content-Length 不符');
  r.slice('正文', r.rest(), decode);
}
