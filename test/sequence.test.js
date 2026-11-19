import test from 'node:test';
import assert from 'node:assert/strict';
import dns from '../src/lessons/dns/index.js';
import tcp from '../src/lessons/tcp/index.js';
import dhcp from '../src/lessons/dhcp/index.js';
import { sequenceLanes, sequenceLayout } from '../src/ui/sequence-layout.js';

const layout = lesson => {
  const packets = lesson.steps.flatMap(({ frames = [] }) => frames.map(id => lesson.frames.find(frame => frame.id === id)));
  return sequenceLayout(lesson, packets, packets.map((packet, i) => ({ packet, members: [i] })));
};

test('时序泳道保持 124px 最小列宽，报文发送和到达保留各自的纵坐标', () => {
  const desktop = sequenceLanes(961, dns.sequenceNodes), mobile = sequenceLanes(364, dns.sequenceNodes);
  assert.deepEqual([...desktop.positions.values()], [163, 334, 505, 675, 846]);
  assert.equal(mobile.width, 728);
  const { headings, messages, notes } = layout(dns);
  assert.equal(headings.length, dns.steps.length);
  assert.deepEqual(messages.map(({ from, to, y1, y2 }) => [from, to, y2 - y1]).slice(0, 3), [
    ['client', 'resolver', 36], ['resolver', 'root', 15], ['root', 'resolver', 15],
  ]);
  assert(notes[1].y >= messages.at(-1).y2);
});

test('时序保留并发丢包、纯步骤和租期时间断点', () => {
  const { messages, notes } = layout(tcp);
  const [lost, delivered] = messages.slice(5, 7);
  assert.equal(lost.sent, delivered.sent);
  assert.equal(delivered.y1 - lost.y1, 30);
  assert.equal(lost.packet.outcome, 'dropped');
  assert(notes[0].y >= lost.y2);
  const renewal = layout(dhcp);
  assert(renewal.headings[0] < renewal.messages[0].y1);
  assert.deepEqual(renewal.breaks.map(({ ms }) => Math.round(ms / 1000)), [43200]);
});
