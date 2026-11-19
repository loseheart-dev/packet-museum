import { overview, outro, steps } from './copy.js';
import { frames } from './frames.js';

const nodes = [
  { id: 'client', label: '客户端', address: 'MAC …:53:10', kind: 'pc', x: 152, y: 362 },
  { id: 'switch', label: '交换机', address: '8 个端口', kind: 'switch', x: 265, y: 230, labelAt: { x: -52, y: -26, anchor: 'end' } },
  { id: 'lan', label: 'NAS', address: 'MAC …:53:20', kind: 'server', x: 332, y: 132, scale: .86, labelAt: { x: -43, y: -52, anchor: 'end' } },
  { id: 'router', label: '路由器', address: 'MAC …:53:01', kind: 'router', x: 449, y: 250 },
  { id: 'isp', label: 'ISP 路由器', address: 'MAC …:53:fe', kind: 'router', x: 624, y: 325 },
];
const links = [
  { nodes: ['client', 'switch'], points: [[224, 292], [243, 233]] },
  { nodes: ['switch', 'lan'], points: [[286, 200], [318, 148]] },
  { nodes: ['switch', 'router'], points: [[310, 213], [410, 239]] },
  { nodes: ['router', 'isp'], points: [[493, 243], [588, 312]] },
];
const local = ['client', 'switch', 'lan', 'router'];
const stepEnds = [0, 1, 3, 5, 9, 11, 12];

export default {
  meta: { id: 'ethernet', title: 'Ethernet', subtitle: '帧与交换机', group: 1, order: 20, layer: 2 },
  overview, outro, nodes, links, frames,
  sequenceNodes: ['client', 'switch', 'lan', 'router', 'isp'],
  legend: {
    arp: { label: 'ARP', tone: 'query' },
    nas: { label: '发往 NAS', tone: 'reply' },
    internet: { label: '发往互联网', tone: 'referral' },
  },
  steps: steps.map((step, i) => ({
    ...step, frames: frames.slice(stepEnds[i], stepEnds[i + 1]).map(frame => frame.id),
    ...(i === 0 ? { closeup: ['client'] } : {}),
    ...(i === 5 ? { wide: true } : { nodes: local }),
  })),
};
