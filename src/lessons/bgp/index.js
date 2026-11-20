import { details, outro, overview } from './copy.js';
import { frames, route } from './frames.js';

const nodes = [
  { id: 'client', label: '客户端', address: '192.168.1.10', kind: 'laptop', x: 59, y: 306 },
  { id: 'router', label: '路由器', address: '192.168.1.1', kind: 'router', x: 285, y: 220 },
  { id: 'isp', label: 'ISP 路由器', address: 'AS 64500', kind: 'edge-router', x: 440, y: 311 },
  { id: 'transit', label: '中转路由器', address: 'AS 64510', kind: 'edge-router', x: 600, y: 211 },
  { id: 'hosting', label: '托管方路由器', address: 'AS 64511', kind: 'edge-router', x: 725, y: 311 },
  { id: 'app', label: 'www.example.com', address: '203.0.113.10', kind: 'server', x: 830, y: 163 },
];
const links = route.slice(1).map((node, i) => ({ nodes: [route[i], node] }));
const bgpNodes = route.slice(2);
const stepScenes = [
  { id: 'networks', closeup: ['isp'], holdMs: 3300 },
  { id: 'tcp', frames: ['syn', 'syn-ack', 'ack'] },
  { id: 'open', frames: ['isp-open', 'transit-open', 'transit-keepalive', 'isp-keepalive'],
    events: [{ node: 'isp', after: 'isp-keepalive', time: '0.016s', text: '会话已建立' }] },
  { id: 'announce', frames: ['announce'] },
  { id: 'propagate', frames: ['forward'], events: [{ node: 'isp', after: 'forward', time: '0.037s', text: '到 203.0.113.0/24 的路由' }] },
  { id: 'follow', frames: ['web-syn', 'web-syn-ack'], nodes: route, wide: true },
  { id: 'withdraw', frames: ['withdraw', 'forward-withdrawal'] },
  { id: 'trust', events: [{ node: 'transit', text: '检查谁可以宣告' }], holdMs: 2700 },
];

export default {
  meta: { id: 'bgp', title: 'BGP', subtitle: '网络之间的路由', group: 1, order: 11, layer: 7 },
  overview, outro, nodes, links, frames, viewBox: [-20, 40, 940, 420],
  sequenceNodes: ['client', ...bgpNodes],
  legend: {
    tcp: { label: 'TCP', tone: 'reply' },
    session: { label: '会话层', tone: 'blue' },
    routes: { label: '路由', tone: 'violet' },
    web: { label: '笔记本电脑的数据包', tone: 'referral' },
  },
  steps: details.map(([title, subtitle, text, facts], i) => ({ title, subtitle, text, facts, nodes: bgpNodes, ...stepScenes[i] })),
};
