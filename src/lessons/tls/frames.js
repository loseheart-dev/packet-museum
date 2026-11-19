import { concat, ethernet, ipv4, tcp, text, tlsExtension, tlsHello, tlsRecord, uint } from '../../lib/bytes/index.js';

export const addresses = { client: '192.168.1.10', router: '192.168.1.1', web: '203.0.113.10' };
export const hostname = 'www.example.com';

function sample(length, seed) {
  return Uint8Array.from({ length }, () => {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    return seed & 255;
  });
}

const vector = (bytes, width) => concat(uint(bytes.length, width), bytes);
const words = (...values) => concat(...values.map(value => uint(value, 2)));
const share = (group, length, seed) => concat(words(group), vector(sample(length, seed), 2));
const hybrid = 0x11ec, x25519 = 0x001d;
const session = sample(32, 2);
const extensions = [
  tlsExtension(0, vector(concat(uint(0, 1), vector(text(hostname), 2)), 2)),
  tlsExtension(10, vector(words(hybrid, x25519), 2)),
  tlsExtension(13, vector(words(0x0403, 0x0804, 0x0807), 2)),
  tlsExtension(16, vector(concat(vector(text('h2'), 1), vector(text('http/1.1'), 1)), 2)),
  tlsExtension(43, vector(words(0x0304, 0x0303), 1)),
  tlsExtension(51, vector(concat(share(hybrid, 1216, 3), share(x25519, 32, 4)), 2)),
];
const client = { random: sample(32, 1), session, suites: [0x1301, 0x1302, 0x1303, 0xc02f], extensions };
const padding = tlsExtension(21, new Uint8Array(1845 - tlsHello(client).length - 4));
const clientHello = tlsRecord({ type: 22, version: 0x0301, payload: tlsHello({ ...client, extensions: [...extensions, padding] }) });
const serverHello = tlsRecord({ type: 22, payload: tlsHello({ server: true, random: sample(32, 5), session,
  extensions: [tlsExtension(43, words(0x0304)), tlsExtension(51, share(hybrid, 1120, 6))],
}) });
const ccs = tlsRecord({ type: 20, payload: uint(1, 1) });
const encrypted = (length, seed) => tlsRecord({ type: 23, payload: sample(length, seed) });
const synOptions = Uint8Array.of(2, 4, 5, 180, 1, 3, 3, 8, 1, 1, 4, 2);
const serverFlight = concat(serverHello, ccs, encrypted(2724, 7));

const packets = [
  [false, 0x02], [true, 0x12], [false, 0x10],
  [false, 0x18, clientHello, 'split'],
  [true, 0x10, serverFlight.subarray(0, 1460), 'partial'],
  [true, 0x10, serverFlight.subarray(1460, 2920), 'partial'],
  [true, 0x18, serverFlight.subarray(2920), 'partial'],
  [false, 0x18, concat(ccs, encrypted(53, 10))],
  [false, 0x18, encrypted(682, 11)],
  [true, 0x18, concat(encrypted(234, 12), encrypted(234, 13))],
  [true, 0x18, encrypted(12705, 14), 'split'],
  [true, 0x18, encrypted(19, 15)],
  [true, 0x11], [false, 0x11],
];

const mac = ['00:00:5e:00:53:10', '00:00:5e:00:53:01'];
const sequence = [0, 0];
let ipID = 0;
export const transportFrames = packets.flatMap(([fromServer, flags, payload, transmission], row) => {
  const chunks = transmission === 'split' ? Array.from({ length: Math.ceil(payload.length / 1460) }, (_, i) => payload.subarray(i * 1460, (i + 1) * 1460)) : [payload];
  const dir = Number(fromServer), peer = 1 - dir;
  const src = fromServer ? addresses.web : addresses.client, dst = fromServer ? addresses.client : addresses.web;
  const srcPort = fromServer ? 443 : 52411, dstPort = fromServer ? 52411 : 443;
  return chunks.map((data, part) => {
    const segment = tcp({ src, dst, srcPort, dstPort, seq: sequence[dir], ack: flags & 0x10 ? sequence[peer] : 0,
      flags: part < chunks.length - 1 ? flags & ~0x08 : flags, options: flags & 0x02 ? synOptions : undefined, payload: data,
    });
    sequence[dir] += (data?.length ?? 0) + Number(Boolean(flags & 0x03));
    return { row, part, fromServer, protocol: data ? 'TLSv1.3' : 'TCP', bytes: ethernet({ src: mac[dir], dst: mac[peer], pad: true,
      payload: ipv4({ src, dst, protocol: 6, payload: segment, id: ++ipID, ttl: fromServer ? 55 : 128 }),
    }), ...(data && !transmission ? { application: 'tls' } : {}) };
  });
});
