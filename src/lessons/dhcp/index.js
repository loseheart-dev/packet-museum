import { intro, messageLabels, overview, outro, steps } from './copy.js';
import { frames } from './frames.js';

export default {
  meta: { id: 'dhcp', title: 'DHCP', subtitle: '动态主机配置', group: 2, order: 16, layer: 7 },
  // shortcut: the no-packet opening is folded into the overview, split it when steps can have zero frames.
  overview: { ...overview, text: `${overview.text} ${intro.text}`, facts: [...overview.facts, ...intro.facts] },
  outro, steps, frames,
  viewBox: [0, 0, 620, 310],
  nodes: [
    { id: 'client', label: '客户端', address: '无 IP 地址', kind: 'pc', x: 166, y: 169 },
    { id: 'router', label: '路由器', address: '192.168.1.1 · DHCP 服务器', kind: 'router', x: 447, y: 135 },
  ],
  links: [{ nodes: ['client', 'router'], points: [[220, 143], [409, 124]] }],
  legend: {
    discover: { label: messageLabels.discover, tone: 'referral' },
    offer: { label: messageLabels.offer, tone: 'query' },
    request: { label: messageLabels.request, tone: 'referral' },
    ack: { label: messageLabels.ack, tone: 'query' },
  },
};
