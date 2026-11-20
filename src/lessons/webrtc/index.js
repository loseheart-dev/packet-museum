import { outro, overview, steps } from './copy.js';
import { addresses, reassembly, stepFrames } from './frames.js';

const para = ([title, subtitle, text, facts]) => ({ title, subtitle, text, facts });
const nodes = [
  { id: 'client', label: '客户端', kind: 'laptop', x: 103, y: 318 },
  { id: 'router', label: '路由器', kind: 'router', x: 249, y: 258 },
  { id: 'internet', label: '互联网', kind: 'cloud', x: 419, y: 326 },
  { id: 'relay', label: 'STUN 服务器', kind: 'stun-server', x: 354, y: 144, scale: .86, labelAt: { x: -16, y: -92 } },
  { id: 'web', label: 'call.example.com', kind: 'web-server', x: 475, y: 177, scale: .86, labelAt: { x: 18, y: -92 } },
  { id: 'remote', label: 'Sam 的路由器', kind: 'router', x: 571, y: 256, labelAt: { x: 36, y: -82 } },
  { id: 'peer', label: 'Sam 的笔记本电脑', kind: 'laptop', x: 660, y: 320 },
].map(node => ({ ...node, address: addresses[node.id] }));
const links = [
  { nodes: ['client', 'router'], points: [[151, 304], [213, 265]] },
  { nodes: ['router', 'internet'], points: [[296, 258], [365, 314]] },
  { nodes: ['internet', 'relay'], points: [[393, 284], [366, 146]] },
  { nodes: ['internet', 'web'], points: [[436, 278], [467, 181]] },
  { nodes: ['internet', 'remote'], points: [[482, 315], [532, 261]] },
  { nodes: ['remote', 'peer'], points: [[614, 259], [626, 290]] },
];
const notes = {
  ice: [{ node: 'internet', text: '穿过两台路由器', after: 'ice-response' }],
  direct: [{ node: 'internet', text: '中间没有服务器' }],
};

export default {
  meta: { id: 'webrtc', title: 'WebRTC', subtitle: '浏览器视频通话', group: 2, order: 3, layer: 7 },
  overview: para(overview), outro: para(outro), nodes, links,
  legend: { signal: { label: '信令', tone: 'blue' }, stun: { label: 'STUN 和 ICE', tone: 'referral' },
    dtls: { label: 'DTLS', tone: 'teal' }, media: { label: '媒体', tone: 'violet' } },
  sequenceNodes: ['client', 'relay', 'web', 'peer'],
  frames: stepFrames.flat(), reassembly,
  steps: steps.map(([id, ...copy], i) => {
    const frames = stepFrames[i].map(frame => frame.id);
    const parallel = reassembly.filter(group => frames.includes(group.frames[0])).map(group => group.frames);
    if (id === 'media') parallel.push(frames.slice(0, 3), frames.slice(3));
    return { id, ...para(copy), frames, parallel, events: notes[id], wide: true,
      ...(id === 'join' ? { closeup: ['client'] } : {}), ...(id === 'direct' ? { holdMs: 4200 } : {}),
    };
  }),
};
