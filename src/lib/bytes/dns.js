import { concat, decode, empty, hex, ipv4Address, ipText, numberHex, requireBytes, size, text, uint } from './core.js';

const typeName = n => ({ 1: 'A', 2: 'NS', 5: 'CNAME', 12: 'PTR', 28: 'AAAA', 41: 'OPT' })[n] ?? String(n);
const nameType = type => typeof type === 'number' ? type : ({ A: 1, NS: 2, CNAME: 5, PTR: 12, AAAA: 28, OPT: 41 })[type];
const isName = type => [2, 5, 12].includes(type);
const asIPv6 = address => new URL(`http://[${address}]/`).hostname.slice(1, -1);

function ipv6Address(address) {
  const [head, tail] = asIPv6(address).split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  return concat(...[...left, ...Array(tail === undefined ? 0 : 8 - left.length - right.length).fill('0'), ...right].map(v => uint(parseInt(v, 16), 2)));
}

export function dns({ id, flags = 0, questions = [], answers = [], authorities = [], additionals = [], compress = true }) {
  const sections = [questions, answers, authorities, additionals];
  const chunks = [uint(id, 2), uint(flags, 2), ...sections.map(section => uint(section.length, 2))];
  let pos = 12;
  const offsets = new Map();
  const write = bytes => { chunks.push(bytes); pos += bytes.length; };
  function writeName(name) {
    const plain = name.replace(/\.$/, '');
    requireBytes(/^[!-~]*$/.test(plain) && plain.length <= 253, `无效的 DNS 名称: ${name}`);
    const labels = plain ? plain.split('.') : [];
    for (let i = 0; i < labels.length; i++) {
      const suffix = labels.slice(i).join('.');
      if (compress && offsets.has(suffix)) return write(uint(0xc000 | offsets.get(suffix), 2));
      if (pos < 0x4000) offsets.set(suffix, pos);
      requireBytes(labels[i].length > 0 && labels[i].length <= 63, `无效的 DNS 标签: ${name}`);
      write(uint(labels[i].length, 1));
      write(text(labels[i]));
    }
    write(uint(0, 1));
  }
  for (const { name, type = 'A', klass = 1 } of questions) {
    writeName(name); write(uint(nameType(type), 2)); write(uint(klass, 2));
  }
  for (const records of sections.slice(1)) for (const { name, type, klass = 1, ttl = 0, data = empty } of records) {
    const kind = nameType(type);
    writeName(name); write(uint(kind, 2)); write(uint(klass, 2)); write(uint(ttl, 4));
    const lengthAt = chunks.length;
    write(uint(0, 2));
    const start = pos;
    if (isName(kind)) writeName(data);
    else write(kind === 1 ? ipv4Address(data) : kind === 28 ? ipv6Address(data) : data);
    chunks[lengthAt] = uint(pos - start, 2);
  }
  return concat(...chunks);
}

export function parseDNS(r) {
  const boundaries = new Set();
  function name(label, limit = r.bytes.length) {
    let pos = r.pos, end;
    const labels = [], seen = new Set();
    while (pos < (end === undefined ? limit : r.bytes.length) && !seen.has(pos)) {
      seen.add(pos);
      boundaries.add(pos);
      const length = r.bytes[pos++];
      if (!length) {
        return r.slice(label, (end ?? pos) - r.pos, () => labels.join('.') || '.');
      }
      if (length >= 192) {
        requireBytes(pos < (end === undefined ? limit : r.bytes.length), 'DNS 压缩指针截断');
        end ??= pos + 1;
        const target = ((length & 63) << 8) | r.bytes[pos];
        requireBytes(target < pos - 1 && boundaries.has(target), 'DNS 压缩指针未指向先前的标签边界');
        pos = target;
      } else {
        requireBytes(length <= 63 && pos + length <= (end === undefined ? limit : r.bytes.length), 'DNS 标签越界');
        labels.push(decode(r.bytes.subarray(pos, pos + length)));
        requireBytes(labels.join('.').length <= 253, '展开后的 DNS 名称过长');
        pos += length;
      }
    }
    throw new RangeError('DNS 名称未终止或压缩指针循环');
  }
  r.number('事务 ID', 2, numberHex);
  r.number('标志', 2, n => `${numberHex(n)} · ${[[0x8000, 'QR'], [0x400, 'AA'], [0x200, 'TC'], [0x100, 'RD'], [0x80, 'RA']].filter(([bit]) => n & bit).map(([, label]) => label).join(' ') || '查询'}`);
  const qd = r.number('问题数', 2);
  const counts = ['回答', '权威', '附加'].map((label, i) => [label, r.number(i ? `${label}记录数` : '回答数', 2)]);
  for (let i = 0; i < qd; i++) {
    name('问题名称'); r.number('查询类型', 2, typeName); r.number('查询类', 2, n => n === 1 ? 'IN' : n);
  }
  for (const [label, count] of counts) for (let i = 0; i < count; i++) {
    name(`${label} ${i + 1} · 名称`);
    const type = r.number('记录类型', 2, typeName);
    r.number(type === 41 ? 'EDNS UDP 大小' : '记录类', 2, n => type !== 41 && n === 1 ? 'IN' : n);
    r.number(type === 41 ? 'EDNS 扩展标志' : 'TTL', 4, n => type === 41 ? `DNSSEC OK = ${(n >> 15) & 1}` : `${n.toLocaleString('en-US')} s`);
    const length = r.number('数据长度', 2, size);
    const end = r.pos + length;
    if (isName(type)) name('名称数据', end);
    else if (type === 1 || type === 28) {
      requireBytes(length === (type === 1 ? 4 : 16), 'DNS 地址记录长度错误');
      r.slice(`${typeName(type)} 地址`, length, type === 1 ? ipText : bytes => asIPv6(Array.from({ length: 8 }, (_, j) => hex(bytes[j * 2] * 256 + bytes[j * 2 + 1], 4)).join(':')));
    } else if (type === 41) {
      while (r.pos < end) {
        requireBytes(end - r.pos >= 4, 'EDNS 选项头截断');
        r.number('EDNS 选项', 2);
        const length = r.number('选项长度', 2);
        requireBytes(length <= end - r.pos, 'EDNS 选项越界');
        r.slice('选项值', length);
      }
    } else r.slice('记录数据', length);
    requireBytes(r.pos === end, 'DNS 记录数据长度错误');
  }
  r.end();
}
