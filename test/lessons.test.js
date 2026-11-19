import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { catalog } from '../src/catalog.js';
import { inspectFrame } from '../src/lib/bytes/index.js';

const root = new URL('../src/lessons/', import.meta.url);
const kinds = ['pc', 'router', 'switch', 'cloud', 'server', 'dns-server', 'dhcp-server', 'web-server'];
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const unique = list => assert.equal(new Set(list).size, list.length, 'ID 重复');
const slug = id => assert.match(id, /^[a-z][a-z0-9-]*$/);
const directions = path => path.slice(1).map((node, i) => [path[i], node].sort().join('>'));

const dirs = readdirSync(root, { withFileTypes: true }).filter(dir => dir.isDirectory() && existsSync(new URL(`${dir.name}/index.js`, root)));
assert(dirs.length > 0, '未发现课程');
for (const { name } of dirs) {
  const { default: lesson } = await import(new URL(`${name}/index.js`, root));
  test(`课程契约：${name}`, async t => {
    const { meta, overview, outro, nodes, links, steps, frames, sequenceNodes, viewBox } = lesson;
    assert.equal(meta.id, name);
    slug(name);
    assert(catalog.some(entry => entry.id === name), '不是一期目录的课程 ID');
    assert(nonempty(meta.title) && nonempty(meta.subtitle));
    assert([1, 2, 3].includes(meta.group) && Number.isInteger(meta.order) && [1, 2, 3, 4, 5, 6, 7].includes(meta.layer));
    assert(nonempty(overview.title) && nonempty(overview.text));
    if (outro) assert(nonempty(outro.title) && nonempty(outro.text));
    if (viewBox) assert(viewBox.length === 4 && viewBox.every(Number.isFinite) && viewBox[2] > 0 && viewBox[3] > 0);
    assert(nodes.length >= 2 && steps.length && frames.length);
    unique(nodes.map(node => node.id)); unique(steps.map(step => step.id)); unique(frames.map(frame => frame.id));
    nodes.forEach(node => {
      slug(node.id);
      assert(kinds.includes(node.kind) && nonempty(node.label) && Number.isFinite(node.x) && Number.isFinite(node.y));
      if (node.scale !== undefined) assert(Number.isFinite(node.scale) && node.scale > 0);
    });
    const nodeById = new Map(nodes.map(node => [node.id, node]));
    const frameById = new Map(frames.map(frame => [frame.id, frame]));
    const linkIds = links.map(({ nodes: pair, points }) => {
      assert(pair.length === 2 && pair[0] !== pair[1] && pair.every(id => nodeById.has(id)), '无效的连线端点');
      const ports = points ?? pair.map(id => [nodeById.get(id).x, nodeById.get(id).y]);
      assert(ports.length === 2 && ports.every(point => point.length === 2 && point.every(Number.isFinite)), '无效的线端坐标');
      assert(ports[0].some((v, i) => v !== ports[1][i]), '零长度连线');
      return directions(pair)[0];
    });
    unique(linkIds);
    if (sequenceNodes) {
      unique(sequenceNodes);
      assert(sequenceNodes.length >= 2 && sequenceNodes.every(id => nodeById.has(id)));
    }
    const legend = lesson.legend ?? { packet: { label: '报文', tone: 'query' } };
    Object.values(legend).forEach(({ label, tone }) => assert(nonempty(label) && ['query', 'referral', 'reply'].includes(tone)));
    const attached = steps.flatMap(step => {
      slug(step.id);
      assert(nonempty(step.title) && nonempty(step.text) && step.frames.length);
      for (const ids of [step.nodes, step.closeup].filter(Boolean)) assert(ids.length && ids.every(id => nodeById.has(id)));
      if (step.closeup) assert(step.closeup.every(id => !step.nodes || step.nodes.includes(id)));
      for (const id of step.frames) {
        const frame = frameById.get(id);
        assert(frame, `找不到步骤引用的帧 ${id}`);
        assert(frame.path.every(id => !step.nodes || step.nodes.includes(id)), '报文路径经过隐藏节点');
      }
      return step.frames;
    });
    unique(attached);
    assert.equal(attached.length, frames.length, '有帧未被步骤引用');
    for (const frame of frames) await t.test(frame.id, () => {
      slug(frame.id);
      assert(frame.path.length > 1 && frame.path.every(id => nodeById.has(id)), '帧引用了未知节点');
      assert(frame.path[0] !== frame.path.at(-1), '时序端点不能相同');
      assert(directions(frame.path).every(link => linkIds.includes(link)), '帧经过没有连线的相邻节点');
      if (sequenceNodes) assert(sequenceNodes.includes(frame.path[0]) && sequenceNodes.includes(frame.path.at(-1)));
      assert(nonempty(frame.time) && nonempty(frame.summary) && nonempty(frame.protocol));
      assert(Object.hasOwn(legend, frame.category ?? 'packet'), '未知的报文图例');
      for (const value of [frame.leadMs, frame.holdMs].filter(value => value !== undefined)) assert(Number.isInteger(value) && value >= 0);
      if (frame.outcome) assert(['delivered', 'dropped'].includes(frame.outcome));
      if (frame.badge) assert(frame.badge.length <= 2 && frame.badge.every(nonempty));
      const { layers } = inspectFrame(frame);
      let offset = 0;
      for (const layer of layers) {
        assert.equal(layer.offset, offset);
        for (const field of layer.fields) {
          assert.equal(field.offset, offset, `字段 ${field.label} 的字节偏移不连续`);
          assert(Number.isInteger(field.length) && field.length > 0);
          offset += field.length;
        }
        assert.equal(offset, layer.offset + layer.length);
      }
      assert.equal(offset, frame.bytes.length);
    });
  });
  const ownTests = new URL(`${name}/test.mjs`, root);
  if (existsSync(ownTests)) await import(ownTests);
}
