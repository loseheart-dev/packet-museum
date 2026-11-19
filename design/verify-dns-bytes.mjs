import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const D = 42;
const fixtures = {
  a: {lengths:[75,86,882,86,154,86,102,91], ids:[39486,20935,20935,11152,11152,58884,58884,39486], ports:[54871,38143,38143,41766,41766,50911,50911,54871]},
  b: {lengths:[71,71,115,71,115,71,87,87], ids:[0x4c21,0x72a1,0x72a1,0x72a2,0x72a2,0x72a3,0x72a3,0x4c21], ports:[53040,53041,53041,53042,53042,53043,53043,53040]}
};
const flags = [0x0100,0,0x8000,0,0x8000,0,0x8400,0x8180];
const ip = b => [...b].join('.');
const sum = b => {
  let n = 0;
  for (let i = 0; i < b.length; i += 2) {
    n += (b[i] << 8) | (b[i+1] || 0);
    n = (n & 0xffff) + (n >>> 16);
  }
  return n;
};

function readName(dns, start, offsets) {
  const labels = [], visited = new Set();
  let pos = start, end;
  while (pos < dns.length && !visited.has(pos)) {
    visited.add(pos);
    const length = dns[pos++];
    if (length === 0) { offsets?.add(pos-1); return [labels.join('.'), end ?? pos]; }
    if (length >= 192) {
      assert(pos < dns.length);
      end ??= pos+1;
      const target = ((length & 63) << 8) | dns[pos];
      assert(target >= 12 && target < pos-1, '压缩指针必须指向前面的 DNS 名称');
      if (offsets) assert(offsets.has(target), '压缩指针必须指向标签边界');
      offsets?.add(pos-1);
      pos = target;
    } else {
      assert(length < 64 && pos + length <= dns.length, 'DNS 标签越界');
      offsets?.add(pos-1);
      labels.push(dns.toString('ascii',pos,pos+length));
      pos += length;
    }
  }
  assert.fail(`DNS 名称未终止: ${start}`);
}

function verifyReference(b, i) {
  const addresses = ['192.168.1.10','8.8.8.8','198.41.0.4','192.5.6.30','198.51.100.53'];
  const [src,dst] = [[0,1],[1,2],[2,1],[1,3],[3,1],[1,4],[4,1],[1,0]][i];
  assert.deepEqual([ip(b.subarray(26,30)),ip(b.subarray(30,34))],[addresses[src],addresses[dst]]);
  const dns = b.subarray(D), offsets = new Set();
  const question = 'www.example.com', zone = i === 2 ? 'com' : 'example.com';
  const names = i === 2 ? [...'abcdefghijklm'].map(letter => `${letter}.gtld-servers.net`) : i === 4 ? ['ns1.example.com','ns2.example.com'] : [];
  const glue4 = i === 2 ? '192.5.6.30 192.33.14.30 192.26.92.30 192.31.80.30 192.12.94.30 192.35.51.30 192.42.93.30 192.54.112.30 192.43.172.30 192.48.79.30 192.52.178.30 192.41.162.30 192.55.83.30'.split(' ') : ['198.51.100.53','198.51.100.54'];
  const glue6 = '2001:503:a83e::2:30 2001:503:231d::2:30 2001:503:83eb::30 2001:500:856e::30 2001:502:1ca1::30 2001:503:d414::30 2001:503:eea3::30 2001:502:8cc::30 2001:503:39c1::30 2001:502:7094::30 2001:503:d2d::30 2001:500:d937::30 2001:501:b1f9::30'.split(' ');
  const edns = i > 0 && i < 7;
  assert.deepEqual([dns.readUInt16BE(6),dns.readUInt16BE(8),dns.readUInt16BE(10)],[+(i>=6),names.length,names.length*(i===2?2:1)+edns]);
  assert.deepEqual(readName(dns,12,offsets),[question,29]);
  assert.deepEqual([dns.readUInt16BE(29),dns.readUInt16BE(31)],[1,1]);
  let pos = 33;
  function record(owner, type, klass, ttl) {
    const [name,next] = readName(dns,pos,offsets);
    assert.equal(name,owner);
    if (type !== 41) assert.equal(next-pos,2,'记录名称应使用压缩指针');
    assert.deepEqual([dns.readUInt16BE(next),dns.readUInt16BE(next+2),dns.readUInt32BE(next+4)],[type,klass,ttl]);
    const start = next+10;
    pos = start+dns.readUInt16BE(next+8);
    assert(pos <= dns.length,'RDATA 长度越界');
    return start;
  }
  if (i >= 6) {
    const start = record(question,1,1,3600);
    assert.equal(ip(dns.subarray(start,pos)),'203.0.113.10');
  }
  for (const name of names) assert.deepEqual(readName(dns,record(zone,2,1,172800),offsets),[name,pos]);
  for (const [j,name] of names.entries()) assert.equal(ip(dns.subarray(record(name,1,1,172800),pos)),glue4[j]);
  if (i === 2) for (const [j,name] of names.entries()) {
    const start = record(name,28,1,172800);
    const address = Array.from({length:8},(_,k) => dns.readUInt16BE(start+2*k).toString(16)).join(':');
    assert.equal(pos-start,16);
    assert.equal(new URL(`http://[${address}]/`).hostname,`[${glue6[j]}]`);
  }
  if (edns) assert.equal(record('',41,1232,0),pos,'EDNS 不应带有选项');
  assert.equal(pos,dns.length,'DNS 字段未覆盖到报文结束');
}

function verify(bytes, i, suffix) {
  const {lengths,ids,ports} = fixtures[suffix];
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
  assert.deepEqual([dns.readUInt16BE(0),dns.readUInt16BE(2),dns.readUInt16BE(4)],[ids[i],flags[i],1]);
  if (suffix === 'a') { verifyReference(b,i); return b; }
  assert.deepEqual([dns.readUInt16BE(6),dns.readUInt16BE(8),dns.readUInt16BE(10)],[+answer,+referral,+referral]);
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

for (const suffix of ['a','b']) {
  const file = `mockup-${suffix}.html`;
  const html = readFileSync(new URL(file,import.meta.url),'utf8');
  const frames = JSON.parse(html.match(/<script type="application\/json" id="frames">([\s\S]+?)<\/script>/)[1]);
  assert.equal(frames.length,8);
  const packets = frames.map((bytes,i) => verify(bytes,i,suffix));
  for (const [q,r] of [[0,7],[1,2],[3,4],[5,6]]) {
    assert.deepEqual(packets[q].subarray(26,30),packets[r].subarray(30,34));
    assert.deepEqual(packets[q].subarray(30,34),packets[r].subarray(26,30));
  }
  console.log(`${file}: ${frames.length} 帧通过（${frames.map(b=>b.length).join('/')} B）；IPv4/UDP 校验和、DNS 偏移与压缩指针正确`);
}
