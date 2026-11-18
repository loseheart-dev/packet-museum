import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const D = 42;
const lengths = [71,71,115,71,115,71,87,87];
const ids = [0x4c21,0x72a1,0x72a1,0x72a2,0x72a2,0x72a3,0x72a3,0x4c21];
const flags = [0x0100,0,0x8000,0,0x8000,0,0x8400,0x8180];
const ports = [53040,53041,53041,53042,53042,53043,53043,53040];
const ip = b => [...b].join('.');
const sum = b => {
  let n = 0;
  for (let i = 0; i < b.length; i += 2) {
    n += (b[i] << 8) | (b[i+1] || 0);
    n = (n & 0xffff) + (n >>> 16);
  }
  return n;
};

function readName(dns, start) {
  const labels = [], visited = new Set();
  let pos = start, end;
  while (pos < dns.length && !visited.has(pos)) {
    visited.add(pos);
    const length = dns[pos++];
    if (length === 0) return [labels.join('.'), end ?? pos];
    if (length >= 192) {
      assert(pos < dns.length);
      end ??= pos+1;
      const target = ((length & 63) << 8) | dns[pos];
      assert(target >= 12 && target < pos-1, '压缩指针必须指向前面的 DNS 名称');
      pos = target;
    } else {
      assert(length < 64 && pos + length <= dns.length, 'DNS 标签越界');
      labels.push(dns.toString('ascii',pos,pos+length));
      pos += length;
    }
  }
  assert.fail(`DNS 名称未终止: ${start}`);
}

function verify(bytes, i) {
  assert(bytes.every(n => Number.isInteger(n) && n >= 0 && n <= 255));
  const b = Buffer.from(bytes), dns = b.subarray(D);
  const referral = i === 2 || i === 4, answer = i >= 6, reply = referral || answer;
  assert.equal(b.length,lengths[i]);
  assert.equal(b.readUInt16BE(12),0x0800);
  assert.equal(b[14],0x45);
  assert.equal(b.readUInt16BE(16),b.length-14);
  assert.equal(b[23],17);
  assert.equal(sum(b.subarray(14,34)),0xffff,'IPv4 首部校验和');
  assert.deepEqual([b.readUInt16BE(34),b.readUInt16BE(36)],reply ? [53,ports[i]] : [ports[i],53]);
  assert.equal(b.readUInt16BE(38),b.length-34);
  assert(b.readUInt16BE(40) > 0);
  assert.equal(sum([...b.subarray(26,34),0,17,...b.subarray(38,40),...b.subarray(34)]),0xffff,'UDP 伪首部校验和');
  assert.deepEqual(Array.from({length:6},(_,j)=>dns.readUInt16BE(j*2)),[ids[i],flags[i],1,+answer,+referral,+referral]);
  assert.deepEqual(readName(dns,12),['lab.example',25]);
  assert.equal(dns.readUInt16BE(25),1);
  assert.equal(dns.readUInt16BE(27),1);
  let pos = 29;
  if (referral) {
    const [zone,server,glue] = i === 2 ? ['example','ns.tld.example','203.0.113.17'] : ['lab.example','ns.lab.example','203.0.113.53'];
    assert.equal(dns.readUInt16BE(pos),i === 2 ? 0xc010 : 0xc00c);
    assert.deepEqual(readName(dns,pos),[zone,31]);
    assert.deepEqual([dns.readUInt16BE(31),dns.readUInt16BE(33),dns.readUInt32BE(35),dns.readUInt16BE(39)],[2,1,60,16]);
    assert.deepEqual(readName(dns,41),[server,57]);
    assert.equal(dns.readUInt16BE(57),0xc029);
    assert.deepEqual(readName(dns,57),[server,59]);
    assert.deepEqual([dns.readUInt16BE(59),dns.readUInt16BE(61),dns.readUInt32BE(63),dns.readUInt16BE(67)],[1,1,60,4]);
    assert.equal(ip(dns.subarray(69,73)),glue);
    pos = 73;
  }
  if (answer) {
    assert.equal(dns.readUInt16BE(pos),0xc00c);
    assert.deepEqual(readName(dns,pos),['lab.example',31]);
    assert.deepEqual([dns.readUInt16BE(31),dns.readUInt16BE(33),dns.readUInt32BE(35),dns.readUInt16BE(39)],[1,1,60,4]);
    assert.equal(ip(dns.subarray(41,45)),'203.0.113.42');
    pos = 45;
  }
  assert.equal(pos,dns.length,'DNS 字段未覆盖到报文结束');
  return b;
}

let first;
for (const suffix of ['a','b']) {
  const file = `mockup-${suffix}.html`;
  const html = readFileSync(new URL(file,import.meta.url),'utf8');
  const frames = JSON.parse(html.match(/<script type="application\/json" id="frames">([\s\S]+?)<\/script>/)[1]);
  assert.equal(frames.length,8);
  const packets = frames.map(verify);
  for (const [q,r] of [[0,7],[1,2],[3,4],[5,6]]) {
    assert.deepEqual(packets[q].subarray(26,30),packets[r].subarray(30,34));
    assert.deepEqual(packets[q].subarray(30,34),packets[r].subarray(26,30));
  }
  if (first) assert.deepEqual(frames,first,'两份样稿的报文不同');
  first = frames;
  console.log(`${file}: ${frames.length} 帧通过（${frames.map(b=>b.length).join('/')} B）；IPv4/UDP 校验和、DNS 偏移与压缩指针正确`);
}
