import { dns, ethernet, ipv4, udp } from '../../lib/bytes/index.js';

const question = 'www.example.com';
const replyAddress = '203.0.113.10';
const rootNames = [...'abcdefghijklm'].map(letter => `${letter}.gtld-servers.net`);
const tldNames = ['ns1.example.com', 'ns2.example.com'];
const ipv4Glue = '192.5.6.30 192.33.14.30 192.26.92.30 192.31.80.30 192.12.94.30 192.35.51.30 192.42.93.30 192.54.112.30 192.43.172.30 192.48.79.30 192.52.178.30 192.41.162.30 192.55.83.30'.split(' ');
const ipv6Glue = '2001:503:a83e::2:30 2001:503:231d::2:30 2001:503:83eb::30 2001:500:856e::30 2001:502:1ca1::30 2001:503:d414::30 2001:503:eea3::30 2001:502:8cc::30 2001:503:39c1::30 2001:502:7094::30 2001:503:d2d::30 2001:500:d937::30 2001:501:b1f9::30'.split(' ');
const answer = { name: question, type: 'A', ttl: 3600, data: replyAddress };
const opt = { name: '.', type: 'OPT', klass: 1232 };
const referral = (zone, names, glue4, glue6 = []) => ({
  authorities: names.map(data => ({ name: zone, type: 'NS', ttl: 172800, data })),
  additionals: [
    ...glue4.map((data, i) => ({ name: names[i], type: 'A', ttl: 172800, data })),
    ...glue6.map((data, i) => ({ name: names[i], type: 'AAAA', ttl: 172800, data })),
    opt
  ]
});

export const addresses = {
  client: '192.168.1.10', gateway: '192.168.1.1', resolver: '8.8.8.8', root: '198.41.0.4', tld: '192.5.6.30', auth: '198.51.100.53'
};

const messages = [
  [0x9a3e, 0x0100, 54871, {}],
  [0x51c7, 0, 38143, { additionals: [opt] }],
  [0x51c7, 0x8000, 38143, referral('com', rootNames, ipv4Glue, ipv6Glue)],
  [0x2b90, 0, 41766, { additionals: [opt] }],
  [0x2b90, 0x8000, 41766, referral('example.com', tldNames, ['198.51.100.53', '198.51.100.54'])],
  [0xe604, 0, 50911, { additionals: [opt] }],
  [0xe604, 0x8400, 50911, { answers: [answer], additionals: [opt] }],
  [0x9a3e, 0x8180, 54871, { answers: [answer] }],
];

export function frameBytes(i, from, to) {
  const [id, flags, port, sections] = messages[i];
  const src = addresses[from], dst = addresses[to], response = flags & 0x8000;
  const payload = dns({ id, flags, questions: [{ name: question }], ...sections });
  const transport = udp({ src, dst, srcPort: response ? 53 : port, dstPort: response ? port : 53, payload });
  const mac = octet => `00:00:5e:00:53:${octet.toString(16).padStart(2, '0')}`;
  return ethernet({ src: mac(i === 7 ? 1 : 16 + (i || 0) + (i > 0 ? 1 : 0)), dst: mac(i === 0 ? 1 : i === 7 ? 16 : 64 + i),
    payload: ipv4({ src, dst, protocol: 17, payload: transport, id: 0xd825 + i, ttl: i === 0 ? 128 : 64, flags: i === 0 ? 0 : 0x4000 }) });
}
