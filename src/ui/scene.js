import { deviceArt, deviceDefs } from '../art/devices.js';
import { $, escape, motion, svgNS } from './dom.js';

const clamp = n => Math.max(0, Math.min(1, n));
const ease = n => n < .5 ? 4 * n ** 3 : 1 - 4 * (1 - n) ** 3;
const mix = (a, b, t) => a.map((value, i) => value + (b[i] - value) * t);
const speed = .145, hopPause = 140, zoomMs = 1100;

export function mountScene(lesson, packets) {
  const network = $('network-svg'), deviceLayer = $('devices'), cableLayer = $('cables');
  network.querySelector('defs')?.remove();
  network.insertAdjacentHTML('afterbegin', deviceDefs);
  cableLayer.replaceChildren();
  deviceLayer.innerHTML = lesson.nodes.map(({ id, kind, label, address, x, y, scale, labelAt = {} }) => {
    const { markup, labelY } = deviceArt(kind, scale);
    const { x: lx = 0, y: ly = labelY, addressX = lx, gap = 16, anchor = 'middle', fontSize } = labelAt;
    return `<g class="node" data-node="${escape(id)}" transform="translate(${x} ${y})">${markup}
      <text x="${lx}" y="${ly}" class="${anchor === 'end' ? 'left-label' : ''}"${fontSize ? ` style="font-size:${fontSize}px"` : ''}>${escape(label)}</text>
      ${address ? `<text class="address ${anchor === 'end' ? 'left-label' : ''}" x="${addressX}" y="${ly + gap}">${escape(address)}</text>` : ''}</g>`;
  }).join('');
  const sceneNodes = [...deviceLayer.children];
  const bounds = new Map(sceneNodes.map(node => {
    const b = node.getBBox(), { e, f } = node.transform.baseVal.getItem(0).matrix;
    return [node.dataset.node, [b.x + e, b.y + f, b.x + b.width + e, b.y + b.height + f]];
  }));
  const nodes = new Map(lesson.nodes.map(node => [node.id, node]));
  const ids = [...nodes.keys()], nodeBoxes = [...bounds.values()];
  const full = lesson.viewBox ?? [0, 0, 760, 460];
  const badge = $('packet-badge').querySelector('rect').getBBox();
  let camera = { from: full, to: full, current: full, intro: full };
  const lanes = new Map();
  const laneId = (a, b) => `${a}>${b}`;
  for (const { nodes: [a, b], points } of lesson.links) {
    const defaultPorts = [a, b].map(id => { const { x, y } = nodes.get(id); return [x, y - 12]; });
    const [start, end] = points ?? defaultPorts.map((point, i) => mix(point, defaultPorts[1 - i], .18));
    const dx = end[0] - start[0], dy = end[1] - start[1], length = Math.hypot(dx, dy);
    for (const [source, target, from, to, offset] of [[a, b, start, end, 3.7], [b, a, end, start, -3.7]]) {
      const move = ([x, y]) => [x - offset * dy / length, y + offset * dx / length];
      const cable = document.createElementNS(svgNS, 'path');
      cable.classList.add('wire');
      cableLayer.append(cable);
      lanes.set(laneId(source, target), { cable, p: move(from), q: move(to), duration: length / speed, source, target });
    }
  }

  const routes = packets.map(({ path }) => {
    let arrival = -hopPause;
    const hops = path.slice(1).map((id, i) => {
      const lane = lanes.get(laneId(path[i], id));
      arrival += lane.duration + hopPause;
      return { lane, arrival };
    });
    return { hops, flight: arrival };
  });

  function frameNodes(visible) {
    const boxes = visible.map(id => bounds.get(id));
    const x = Math.min(...boxes.map(b => b[0])), y = Math.min(...boxes.map(b => b[1]));
    const w = Math.max(...boxes.map(b => b[2])) - x, h = Math.max(...boxes.map(b => b[3])) - y;
    const aspect = network.clientHeight ? network.clientWidth / network.clientHeight : full[2] / full[3];
    const width = Math.max(325, w + 24, (h + 34) * aspect), height = width / aspect;
    return [x + (w - width) / 2, y + (h - height) / 2, width, height];
  }

  function aim(state, snap = false) {
    const { closeup, wide, nodes: visible } = lesson.steps[packets[state.index].step];
    const to = !state.started || wide ? full : frameNodes(visible ?? ids);
    camera = { ...camera, from: snap ? to : camera.current, to, intro: closeup ? frameNodes(closeup) : to };
  }

  function positionAt(route, ms) {
    for (const { lane } of route.hops) {
      if (ms <= lane.duration + hopPause || lane === route.hops.at(-1).lane) return mix(lane.p, lane.q, clamp(ms / lane.duration));
      ms -= lane.duration + hopPause;
    }
  }

  function badgeOffset(x, y) {
    const [left, top, width, height] = camera.current;
    const offsets = [[0, -26], [0, 29], [83, 0], [-83, 0], [59, -26], [-59, -26], [59, 29], [-59, 29], [32, -54], [-32, -54], [36, 49], [-36, 49]];
    return offsets.find(([dx, dy]) => {
      const l = x + dx + badge.x - 5, r = l + badge.width + 10, t = y + dy + badge.y, b = t + badge.height;
      return l >= left && r <= left + width && t >= top && b <= top + height && !nodeBoxes.some(([a, c, d, e]) => l < d && r > a && t < e && b > c);
    }) ?? offsets[0];
  }

  function paint({ started, finished, running, elapsed, index }, progress) {
    const packet = packets[index], { flight, hops } = routes[index];
    const step = lesson.steps[packet.step], moving = !motion.matches;
    const lead = packet.leadMs, age = elapsed - lead - flight;
    const detailIntro = moving && started && packet.firstInStep && step.closeup && elapsed < lead;
    const zoom = moving ? ease(clamp(elapsed / zoomMs)) : 1;
    camera.current = detailIntro ? (elapsed < zoomMs ? mix(camera.from, camera.intro, zoom) : mix(camera.intro, camera.to, ease(clamp((elapsed - zoomMs) / zoomMs)))) : mix(camera.from, camera.to, zoom);
    network.setAttribute('viewBox', camera.current.join(' '));
    const seen = !started ? ids : detailIntro && elapsed < zoomMs ? step.closeup : step.nodes ?? ids;
    const old = lesson.steps[packet.step - 1]?.nodes ?? (packet.step === 0 ? step.closeup ?? [] : ids);
    const enteringAt = step.closeup ? zoomMs : 0;
    const entering = id => moving && running && packet.firstInStep && !old.includes(id);
    const flying = started && elapsed >= lead && age <= 180 && !finished;
    for (const lane of lanes.values()) {
      const on = flying && hops.some(hop => hop.lane === lane);
      const visible = seen.includes(lane.source) && seen.includes(lane.target);
      const reveal = entering(lane.source) || entering(lane.target) ? 1 - (1 - clamp((elapsed - enteringAt - 120) / 520)) ** 3 : 1;
      const hidden = !visible || reveal < .015;
      if (hidden !== lane.hidden) lane.cable.toggleAttribute('hidden', lane.hidden = hidden);
      if (on !== lane.active) {
        lane.cable.classList.toggle('active', lane.active = on);
        lane.cable.setAttribute('marker-end', on ? 'url(#head-active)' : 'url(#head-idle)');
      }
      if (lane.reveal !== reveal) {
        lane.reveal = reveal;
        lane.cable.setAttribute('d', `M${lane.p.join(' ')} L${mix(lane.p, lane.q, reveal).join(' ')}`);
      }
    }
    const flyTime = moving ? elapsed - lead : progress === 1 ? flight : flight / 2;
    const [x, y] = positionAt(routes[index], flyTime);
    const dot = $('packet');
    dot.setAttribute('visibility', flying ? 'visible' : 'hidden');
    dot.setAttribute('tabindex', flying ? '0' : '-1');
    if (flying) {
      dot.setAttribute('transform', `translate(${x} ${y}) scale(${moving ? (1 - (1 - clamp(flyTime / 220)) ** 3) * (1 - clamp(age / 180) ** 3) : 1})`);
      $('packet-badge').setAttribute('transform', `translate(${badgeOffset(x, y).join(' ')})`);
      dot.querySelectorAll('.trail').forEach((trail, i) => {
        const [tx, ty] = positionAt(routes[index], flyTime - 70 * (i + 1));
        trail.setAttribute('cx', tx - x); trail.setAttribute('cy', ty - y);
      });
    }
    const glow = $('arrival');
    glow.setAttribute('cx', x); glow.setAttribute('cy', y);
    glow.setAttribute('r', moving ? 9 + 30 * clamp(age / 700) : 13);
    glow.setAttribute('opacity', progress === 1 && started && !finished && packet.outcome !== 'dropped' ? (moving ? .6 * (1 - clamp(age / 700)) : .65) : 0);
    const [left, top, w, h] = camera.current;
    for (const node of sceneNodes) {
      const id = node.dataset.node, [x1, y1, x2, y2] = bounds.get(id);
      const appear = entering(id) ? clamp((elapsed - enteringAt) / 650) : 1;
      const hop = hops.find(({ lane }) => lane.target === id);
      const bump = moving && hop ? Math.sin(Math.PI * clamp((flyTime - hop.arrival) / 340)) : 0;
      const inView = started && !step.wide ? clamp(Math.min(x1 - left, y1 - top, left + w - x2, top + h - y2) / 13) : 1;
      node.style.opacity = seen.includes(id) ? inView * appear : 0;
      node.style.translate = `0 ${-15 * (1 - appear) ** 3 - bump * 3.5}px`;
      node.classList.toggle('received', progress === 1 && packet.outcome !== 'dropped' && id === packet.path.at(-1) && (!moving || age < 700));
    }
  }

  function setPacket(packet, state) {
    network.dataset.tone = packet.kind.tone;
    $('packet-tag').textContent = packet.kind.title;
    [...$('packet-label').children].forEach((line, i) => { line.textContent = packet.badge[i] ?? ''; });
    sceneNodes.forEach(node => node.classList.toggle('active', state.started && packet.path.includes(node.dataset.node)));
  }

  return { aim, paint, setPacket, flights: routes.map(route => route.flight) };
}
