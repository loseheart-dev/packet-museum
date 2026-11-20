import { overview, outro, steps } from './copy.js';
import { frames, linkLocal, router } from './frames.js';

const client = 'client', endpoints = [client, 'router'];
const available = '没有回答：地址可用';
const locate = [
  { closeup: [client], events: [{ node: client, after: 'ipv6-1', text: available }],
    nodeUpdates: { client: { after: 'ipv6-1', address: linkLocal } } },
  {},
  {},
  { events: [{ node: client, after: 'ipv6-4', text: available }],
    nodeUpdates: { client: { after: 'ipv6-4', address: '2001:db8:1234:5678:…' } } },
  {},
  { wide: true, events: [{ node: client, text: '通过 IPv6 上网' }] },
];

export default {
  meta: { id: 'ipv6', title: 'IPv6', subtitle: '地址配置', group: 1, order: 12, layer: 3 },
  overview, outro, frames,
  nodes: [
    { id: client, label: '客户端', address: '没有 IPv6 地址', kind: 'laptop', x: 260, y: 297, labelAt: { x: -12, y: 37, addressX: 28 } },
    { id: 'router', label: '路由器', address: router, kind: 'router', x: 495, y: 218 },
  ],
  links: [{ nodes: endpoints, points: [[309, 273], [460, 218]] }],
  legend: { client: { label: '来自笔记本电脑', tone: 'referral' }, router: { label: '来自路由器', tone: 'violet' } },
  steps: steps.map(([title, subtitle, text, facts], i) => ({
    id: ['link-local', 'solicitation', 'advertisement', 'global', 'neighbor', 'ready'][i], title, subtitle, text, facts,
    frames: [[frames[0]], [frames[1]], [frames[2]], [frames[3]], frames.slice(4), []][i].map(frame => frame.id),
    nodes: endpoints, ...locate[i],
  })),
};
