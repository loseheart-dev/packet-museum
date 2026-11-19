import { arp, ethernet, ipv4, tcp } from '../../lib/bytes/index.js';

export const addresses = { client: '192.168.1.10', router: '192.168.1.1', public: '198.51.100.7', web: '203.0.113.10' };
const { client, router, public: wan, web } = addresses;
const mac = {
  client: '00:00:5e:00:53:10', lan: '00:00:5e:00:53:01', wan: '00:00:5e:00:53:02',
  isp: '00:00:5e:00:53:fe', web: '00:00:5e:00:53:40', webRouter: '00:00:5e:00:53:80',
};

const request = ethernet({ src: mac.client, dst: 'ff:ff:ff:ff:ff:ff', type: 0x0806, pad: true,
  payload: arp({ operation: 1, senderMac: mac.client, senderIp: client, targetIp: router }) });
const response = ethernet({ src: mac.lan, dst: mac.client, type: 0x0806, pad: true,
  payload: arp({ operation: 2, senderMac: mac.lan, senderIp: router, targetMac: mac.client, targetIp: client }) });

const syn = [2, 4, 0x05, 0xb4, 1, 3, 3, 8, 1, 1, 4, 2];
const synAck = [2, 4, 0x05, 0xb4, 1, 1, 4, 2, 1, 3, 3, 7];

function segment(srcMac, dstMac, ttl, translated, reply = false) {
  const [host, port] = translated ? [wan, 40112] : [client, 52344];
  const [src, dst, srcPort, dstPort] = reply ? [web, host, 443, port] : [host, web, port, 443];
  const payload = tcp({ src, dst, srcPort, dstPort, seq: reply ? 0x8f49d520 : 0xb5cc295f,
    ack: reply ? 0xb5cc2960 : 0, flags: reply ? 0x12 : 0x02, window: 64240,
    options: Uint8Array.from(reply ? synAck : syn) });
  return ethernet({ src: srcMac, dst: dstMac,
    payload: ipv4({ src, dst, id: reply ? 0x0e03 : 0xd825, ttl, protocol: 6, payload }) });
}

export const frames = [
  ['arp-request', ['client', 'router'], '0.000s', 'Who has 192.168.1.1? Tell 192.168.1.10',
    ['谁有 192.168.1.1？', '请告诉 192.168.1.10'], request, 'arp', 1250],
  ['arp-reply', ['router', 'client'], '0.001s', `192.168.1.1 is at ${mac.lan}`,
    ['192.168.1.1 的 MAC', mac.lan], response, 'arp', 1300],
  ['syn-lan', ['client', 'router'], '0.002s', 'TTL 128 · 52344 → 443 [SYN]',
    ['192.168.1.10 → 203.0.113.10', 'TTL 128 · 协议 TCP'], segment(mac.client, mac.lan, 128, false), 'outgoing', 1250],
  ['syn-wan', ['router', 'internet', 'web'], '0.003s', 'TTL 127 · 40112 → 443 [SYN]（NAT 之后）',
    ['198.51.100.7 → 203.0.113.10', 'TTL 127 · NAT 之后'], segment(mac.wan, mac.isp, 127, true), 'outgoing', 1450],
  ['reply-web', ['web', 'internet', 'router'], '0.019s', 'TTL 64 · 443 → 40112 [SYN, ACK]',
    ['203.0.113.10 → 198.51.100.7', 'TTL 64 · SYN-ACK'], segment(mac.web, mac.webRouter, 64, true, true), 'reply', 1150],
  ['reply-lan', ['router', 'client'], '0.035s', 'TTL 52 · 443 → 52344 [SYN, ACK]（NAT 之后）',
    ['203.0.113.10 → 192.168.1.10', 'TTL 52 · NAT 之后'], segment(mac.lan, mac.client, 52, false, true), 'reply', 850],
].map(([id, path, time, summary, badge, bytes, category, leadMs]) => ({
  id, path, time, summary, badge, bytes, category, leadMs, holdMs: 1800, protocol: category === 'arp' ? 'ARP' : 'TCP',
}));
