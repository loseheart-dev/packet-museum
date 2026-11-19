import { intro, overview, outro, steps } from './copy.js';
import { frames } from './frames.js';

export default {
  meta: { id: 'dhcp', title: 'DHCP', subtitle: 'Dynamic Host Configuration', group: 2, order: 16, layer: 7 },
  // shortcut: the no-packet opening is folded into the overview, split it when steps can have zero frames.
  overview: { ...overview, text: `${overview.text} ${intro.text}`, facts: [...overview.facts, ...intro.facts] },
  outro, steps, frames,
  viewBox: [0, 0, 620, 310],
  nodes: [
    { id: 'client', label: 'Client', address: 'No IP address', kind: 'pc', x: 166, y: 169 },
    { id: 'router', label: 'Router', address: '192.168.1.1 · DHCP server', kind: 'router', x: 447, y: 135 },
  ],
  links: [{ nodes: ['client', 'router'], points: [[220, 143], [409, 124]] }],
  legend: {
    discover: { label: 'DISCOVER', tone: 'referral' },
    offer: { label: 'OFFER', tone: 'query' },
    request: { label: 'REQUEST', tone: 'referral' },
    ack: { label: 'ACK', tone: 'query' },
  },
};
