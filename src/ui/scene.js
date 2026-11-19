import { deviceArt, deviceDefs } from '../art/devices.js';
import { $, escape, motion, svgNS } from './dom.js';

const clamp = n => Math.max(0, Math.min(1, n));
const ease = n => n < .5 ? 4 * n ** 3 : 1 - 4 * (1 - n) ** 3;
const mix = (a, b, t) => a.map((value, i) => value + (b[i] - value) * t);
const speed = .145, hopPause = 140, zoomMs = 1100;

export function mountScene(lesson, packets, groups) {
  const network = $('network-svg'), deviceLayer = $('devices'), cableLayer = $('cables');
  network.querySelector('defs')?.remove();
  network.insertAdjacentHTML('afterbegin', deviceDefs);
  cableLayer.replaceChildren();
  deviceLayer.innerHTML = lesson.nodes.map(({ id, kind, label, address, x, y, scale, status, labelAt = {} }) => {
    const { markup, labelY } = deviceArt(kind, scale);
    const { x: lx = 0, y: ly = labelY, addressX = lx, gap = 16, anchor = 'middle', fontSize } = labelAt;
    return `<g class="node" data-node="${escape(id)}" transform="translate(${x} ${y})">${markup}
      <text data-part="label" x="${lx}" y="${ly}" class="${anchor === 'end' ? 'left-label' : ''}"${fontSize ? ` style="font-size:${fontSize}px"` : ''}>${escape(label)}</text>
      <text data-part="address" class="address ${anchor === 'end' ? 'left-label' : ''}" x="${addressX}" y="${ly + gap}">${escape(address ?? '')}</text>
      <text data-part="status" class="address ${anchor === 'end' ? 'left-label' : ''}" x="${addressX}" y="${ly + 2 * gap}">${escape(status ?? '')}</text></g>`;
  }).join('');
  const sceneNodes = [...deviceLayer.children];
  const bounds = new Map(sceneNodes.map(node => {
    const b = node.getBBox(), { e, f } = node.transform.baseVal.getItem(0).matrix;
    return [node.dataset.node, [b.x + e, b.y + f, b.x + b.width + e, b.y + b.height + f]];
  }));
  const nodes = new Map(lesson.nodes.map(node => [node.id, node]));
  const ids = [...nodes.keys()];
  const full = lesson.viewBox ?? [0, 0, 760, 460];
  const dots = $('packet-dots');
  dots.replaceChildren();
  const template = $('packet-template').content.querySelector('g');
  const visuals = [];
  function visual(i) {
    if (visuals[i]) return visuals[i];
    const group = dots.appendChild(template.cloneNode(true));
    const badge = group.querySelector('.packet-badge');
    return visuals[i] = { group, dot: group.querySelector('.packet'), glyph: group.querySelector('.packet-glyph'), glow: group.querySelector('.arrival'), drop: group.querySelector('.packet-drop'), badge, trails: group.querySelectorAll('.trail') };
  }
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

  const routes = packets.map(({ path, outcome }) => {
    let arrival = -hopPause;
    const hops = path.slice(1).map((id, i) => {
      const lane = lanes.get(laneId(path[i], id));
      arrival += lane.duration + hopPause;
      return { lane, arrival };
    });
    return { hops, flight: outcome === 'dropped' ? arrival * .59 : arrival };
  });
  const folded = new Set(groups.filter(group => !group.separateRows).flatMap(group => group.members.slice(1)));

  function frameNodes(visible) {
    const boxes = visible.map(id => bounds.get(id));
    const x = Math.min(...boxes.map(b => b[0])), y = Math.min(...boxes.map(b => b[1]));
    const w = Math.max(...boxes.map(b => b[2])) - x, h = Math.max(...boxes.map(b => b[3])) - y;
    const aspect = network.clientHeight ? network.clientWidth / network.clientHeight : full[2] / full[3];
    const width = Math.max(325, w + 24, (h + 34) * aspect), height = width / aspect;
    return [x + (w - width) / 2, y + (h - height) / 2, width, height];
  }

  function aim(state, unit, snap = false) {
    const { closeup, wide, nodes: visible } = lesson.steps[unit.step];
    const to = !state.started || wide ? full : frameNodes(visible ?? ids);
    camera = { ...camera, from: snap ? to : camera.current, to, intro: closeup ? frameNodes(closeup) : to };
  }

  function positionAt(route, ms) {
    for (const { lane } of route.hops) {
      if (ms <= lane.duration + hopPause || lane === route.hops.at(-1).lane) return mix(lane.p, lane.q, clamp(ms / lane.duration));
      ms -= lane.duration + hopPause;
    }
  }

  function sizeBadge(badge, { badge: lines, badgeLabel, kind, locked }, below) {
    const tag = badge.querySelector('.packet-tag'), fields = [...badge.querySelectorAll('tspan')];
    const band = badge.querySelector('.packet-band'), body = badge.querySelector('.packet-body'), lock = badge.querySelector('.packet-lock');
    tag.textContent = badgeLabel ?? kind.title;
    fields.forEach((line, i) => { line.textContent = lines[i] ?? ''; });
    const titleWidth = tag.getComputedTextLength();
    const width = Math.max(titleWidth + (locked ? 13 : 0), ...fields.map(line => line.getComputedTextLength())) + 16;
    const height = lines.length ? lines.length * 11 + 4 : 0;
    const offset = below ? height + 28 : -13;
    for (const rect of [body, band]) {
      rect.setAttribute('x', -width / 2);
      rect.setAttribute('width', width);
    }
    band.setAttribute('y', -height - 15);
    body.setAttribute('y', -height);
    body.setAttribute('height', height);
    body.toggleAttribute('hidden', !height);
    fields[0].parentElement.setAttribute('y', 10 - height);
    tag.setAttribute('x', locked ? 6.5 : 0);
    tag.setAttribute('y', -height - 4);
    lock.setAttribute('transform', `translate(${-titleWidth / 2 - 2} ${-height - 7})`);
    lock.toggleAttribute('hidden', !locked);
    badge.setAttribute('transform', `translate(0 ${offset})`);
    return offset;
  }

  function paint({ started, finished, running, elapsed }, unit, updatedNodes) {
    const step = lesson.steps[unit.step], moving = !motion.matches;
    const detailIntro = moving && started && unit.start && step.closeup && elapsed < (unit.leadMs || 2 * zoomMs);
    const zoom = moving ? ease(clamp(elapsed / zoomMs)) : 1;
    camera.current = detailIntro ? (elapsed < zoomMs ? mix(camera.from, camera.intro, zoom) : mix(camera.intro, camera.to, ease(clamp((elapsed - zoomMs) / zoomMs)))) : mix(camera.from, camera.to, zoom);
    network.setAttribute('viewBox', camera.current.join(' '));
    const seen = !started ? ids : detailIntro && elapsed < zoomMs ? step.closeup : step.nodes ?? ids;
    const old = lesson.steps[unit.step - 1]?.nodes ?? (unit.step === 0 ? step.closeup ?? [] : ids);
    const enteringAt = step.closeup ? zoomMs : 0;
    const entering = id => moving && running && unit.start && !old.includes(id);
    const members = unit.members.filter(i => !folded.has(i)).map(i => {
      const packet = packets[i], route = routes[i], age = elapsed - packet.leadMs - route.flight;
      return { packet, route, age, i, flying: started && elapsed >= packet.leadMs && age <= (packet.outcome === 'dropped' ? 0 : 180) && !finished };
    });
    for (const lane of lanes.values()) {
      const active = members.find(({ flying, route }) => flying && route.hops.some(hop => hop.lane === lane));
      const on = active?.packet.kind.tone;
      const visible = seen.includes(lane.source) && seen.includes(lane.target);
      const reveal = entering(lane.source) || entering(lane.target) ? 1 - (1 - clamp((elapsed - enteringAt - 120) / 520)) ** 3 : 1;
      const hidden = !visible || reveal < .015;
      if (hidden !== lane.hidden) lane.cable.toggleAttribute('hidden', lane.hidden = hidden);
      if (on !== lane.active) {
        lane.active = on;
        lane.cable.classList.toggle('active', Boolean(on));
        lane.cable.dataset.tone = on ?? '';
        lane.cable.setAttribute('marker-end', on ? 'url(#head-active)' : 'url(#head-idle)');
      }
      if (lane.reveal !== reveal) {
        lane.reveal = reveal;
        lane.cable.setAttribute('d', `M${lane.p.join(' ')} L${mix(lane.p, lane.q, reveal).join(' ')}`);
      }
    }
    members.forEach(({ packet, route, age, flying, i }, slot) => {
      const sprite = visual(slot), { group, dot, glyph, glow, drop, badge, trails } = sprite;
      group.removeAttribute('hidden');
      if (dot.dataset.packet !== String(i)) {
        dot.dataset.packet = i;
        dot.setAttribute('aria-label', `检查报文 ${i + 1}：${packet.badgeLabel ?? packet.kind.title}`);
        group.dataset.tone = packet.kind.tone;
        sprite.badgeY = sizeBadge(badge, packet, slot % 2);
      }
      dot.setAttribute('visibility', flying ? 'visible' : 'hidden');
      dot.setAttribute('tabindex', flying ? '0' : '-1');
      const flyTime = moving ? Math.min(route.flight, elapsed - packet.leadMs) : age >= 0 ? route.flight : route.flight / 2;
      const [x, y] = positionAt(route, flyTime);
      const dropped = started && !finished && packet.outcome === 'dropped' && age >= 0 && age < 700;
      drop.toggleAttribute('hidden', !dropped);
      if (dropped) drop.setAttribute('transform', `translate(${x} ${y})`);
      if (flying) {
        const visibility = moving ? (1 - (1 - clamp(flyTime / 220)) ** 3) * (1 - clamp(age / 180) ** 3) : 1;
        // A shared translation keeps the badge anchored while the glyph pulses.
        dot.setAttribute('transform', `translate(${x} ${y})`);
        glyph.setAttribute('transform', `scale(${visibility})`);
        badge.setAttribute('opacity', visibility);
        if (import.meta.env.DEV) console.assert(badge.transform.baseVal.getItem(0).matrix.f === sprite.badgeY, 'Packet badge changed its vertical offset in flight');
        trails.forEach((trail, j) => {
          const [tx, ty] = positionAt(route, flyTime - 70 * (j + 1));
          trail.setAttribute('cx', tx - x); trail.setAttribute('cy', ty - y);
        });
      }
      glow.setAttribute('cx', x); glow.setAttribute('cy', y);
      glow.setAttribute('r', moving ? 9 + 30 * clamp(age / 700) : 13);
      glow.setAttribute('opacity', age >= 0 && started && !finished && packet.outcome !== 'dropped' ? (moving ? .6 * (1 - clamp(age / 700)) : .65) : 0);
    });
    visuals.slice(members.length).forEach(({ group, dot }) => { group.setAttribute('hidden', ''); dot.setAttribute('tabindex', '-1'); });
    const [left, top, w, h] = camera.current;
    for (const node of sceneNodes) {
      const id = node.dataset.node, [x1, y1, x2, y2] = bounds.get(id);
      const appear = entering(id) ? clamp((elapsed - enteringAt) / 650) : 1;
      const arrival = members.find(({ packet, age }) => packet.outcome !== 'dropped' && packet.path.at(-1) === id && age >= 0 && (!moving || age < 700));
      const bump = moving && arrival ? Math.sin(Math.PI * clamp(arrival.age / 340)) : 0;
      const inView = started && !step.wide ? clamp(Math.min(x1 - left, y1 - top, left + w - x2, top + h - y2) / 13) : 1;
      node.style.opacity = seen.includes(id) ? inView * appear : 0;
      node.style.translate = `0 ${-15 * (1 - appear) ** 3 - bump * 3.5}px`;
      node.classList.toggle('active', started && members.some(({ packet }) => packet.path.includes(id)));
      node.classList.toggle('received', started && Boolean(arrival));
      node.dataset.tone = arrival?.packet.kind.tone ?? '';
      for (const label of node.querySelectorAll('[data-part]')) {
        const part = label.dataset.part, text = updatedNodes.get(id)?.[part] ?? nodes.get(id)[part] ?? '';
        if (label.textContent !== text) label.textContent = text;
      }
    }
  }

  return { aim, paint, flights: routes.map(route => route.flight) };
}
