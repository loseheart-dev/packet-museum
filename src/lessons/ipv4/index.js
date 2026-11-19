import { overview, outro, steps } from './copy.js';
import { addresses, frames } from './frames.js';

const local = ['client', 'router'];
const nodes = [
  { id: 'client', label: '客户端', kind: 'pc', address: addresses.client, x: 116, y: 302 },
  { id: 'router', label: '路由器', kind: 'router', address: addresses.router, x: 288, y: 230 },
  { id: 'internet', label: '互联网', kind: 'cloud', x: 500, y: 305 },
  { id: 'web', label: 'Web 服务器', kind: 'web-server', address: addresses.web, x: 648, y: 145 },
];
const links = [
  { nodes: local, points: [[172, 277], [250, 233]] },
  { nodes: ['router', 'internet'], points: [[328, 230], [452, 290]] },
  { nodes: ['internet', 'web'], points: [[531, 257], [617, 142]] },
];
// shortcut: 现有引擎要求每步有帧，支持纯讲解步骤后把请求移回 ARP 步骤。
const stepFrames = [['arp-request'], ['arp-reply'], ['syn-lan'], ['syn-wan', 'syn-web'], ['reply-web', 'reply-wan', 'reply-lan']];

export default {
  meta: { id: 'ipv4', title: 'IP', subtitle: overview.subtitle, group: 1, order: 10, layer: 3 },
  overview, outro, nodes, links, frames,
  legend: {
    arp: { label: 'ARP', tone: 'query' },
    outgoing: { label: '发出的数据包', title: 'IP 数据包', tone: 'referral' },
    reply: { label: '回复', title: '应答', tone: 'reply' },
  },
  steps: steps.map((step, i) => ({
    ...step, frames: stepFrames[i], ...(i < 3 ? { nodes: local } : { wide: true }),
    ...(i === 0 ? { closeup: ['client'] } : {}),
  })),
};
