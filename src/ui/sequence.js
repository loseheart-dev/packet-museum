import { $, escape, motion } from './dom.js';
import { sequenceLanes, sequenceLayout } from './sequence-layout.js';

function caption({ protocol, summary, kind, category, application }) {
  if (protocol === 'TCP' && (category === 'control' || kind.title === 'TCP' || kind.title === 'FIN')) {
    if (summary.includes('SLE=')) return '重复 ACK';
    return (/\[([A-Z, ]+)\]/.exec(summary)?.[1] ?? kind.title).replace(', ACK', '-ACK').replace('FIN-ACK', 'FIN');
  }
  if (summary.includes('TCP Retransmission')) return '重传';
  if (protocol === 'DHCP') return category.toUpperCase();
  if (application === 'tls' || protocol === 'TLSv1.3') {
    if (summary.startsWith('加密握手')) return '已加密';
    return /Client Hello|Server Hello|Finished|New Session Ticket|close_notify/i.exec(summary)?.[0]?.toUpperCase().replace('NEW SESSION TICKET', 'TICKETS')
      ?? (summary.startsWith('Application Data') ? '应用数据' : '已加密');
  }
  return kind.title;
}

export function mountSequence(lesson, packets, labels, entries) {
  const root = $('sequence');
  root.innerHTML = '<div class="seq-head"><div class="seq-track"></div></div><div class="seq-scroll" tabindex="0" role="region" aria-label="时序图"><svg role="group"></svg></div>';
  const head = root.querySelector('.seq-head'), track = root.querySelector('.seq-track');
  const scroll = root.querySelector('.seq-scroll'), svg = root.querySelector('svg');
  scroll.onscroll = () => { track.style.transform = `translateX(${-scroll.scrollLeft}px)`; };
  const { messages, headings, notes, breaks, height } = sequenceLayout(lesson, packets, entries);
  const ends = new Set(messages.flatMap(({ from, to }) => [from, to]));
  const ids = [...new Set([...(lesson.sequenceNodes ?? lesson.nodes.map(({ id }) => id)), ...ends])].filter(id => ends.has(id));
  const addresses = new Map(lesson.nodes.map(({ id, address }) => [id, address]));
  let width, arrows = [], badges = [], steps = [], lanes = [], selected;

  function reflow() {
    const next = sequenceLanes(scroll.clientWidth, ids);
    if (width === next.width) return false;
    width = next.width;
    const { gap, positions: x } = next;
    track.style.width = `${width}px`;
    track.innerHTML = ids.map(id => `<div class="seq-who" style="left:${x.get(id)}px;width:${Math.floor(gap - 10)}px"><b>${escape(labels.get(id))}</b><span></span></div>`).join('');
    lanes = [...track.querySelectorAll('span')];
    svg.setAttribute('width', width);
    svg.setAttribute('height', Math.max(height, scroll.clientHeight));
    const life = ids.map(id => `<line class="seq-life" x1="${x.get(id)}" x2="${x.get(id)}" y2="100%"/>`).join('');
    const dividers = headings.map((y, i) => `<g class="seq-step" transform="translate(0 ${y})"><line x1="10" x2="${width - 10}"/><text x="12">步骤 ${i + 1} · ${escape(lesson.steps[i].title)}</text></g>`).join('');
    const pauses = breaks.map(({ y, ms }) => `<g class="seq-break" transform="translate(0 ${y})"><rect y="-15" width="${width}" height="30"/><rect class="seq-wave" y="-10" width="${width}" height="20"/><g transform="translate(${width / 2})"><rect class="seq-pill" y="-10" height="20" rx="10"/><text text-anchor="middle">${ms >= 60000 ? `${+(ms / 60000).toFixed(1)} 分钟` : `${+(ms / 1000).toFixed(2)} 秒`}后</text></g></g>`).join('');
    const annotations = notes.map(({ node, text, y, from, to }) => {
      const anchor = x.get(node), at = anchor ?? (from ? (x.get(from) + x.get(to)) / 2 : x.get(ids[0]) ?? 78);
      const left = anchor && node === ids.at(-1), align = anchor ? left ? 'end' : 'start' : 'middle';
      const room = anchor ? (left ? at : width - at) - 36 : 2 * Math.min(at, width - at) - 24;
      return `<g class="seq-note" transform="translate(${at} ${y})"><title>${escape(text)}</title>${anchor ? '<circle r="3"/>' : ''}<g transform="translate(${anchor ? left ? -18 : 18 : 0})"><rect class="seq-pill" data-room="${room}" y="-10" height="20" rx="2"/><text text-anchor="${align}">${escape(text)}</text></g></g>`;
    }).join('');
    const messageMarkup = messages.map(({ members, packet, from, to, y1, y2 }) => {
      const start = x.get(from), dropped = packet.outcome === 'dropped';
      const end = dropped ? (start + x.get(to)) / 2 : x.get(to), y = dropped ? (y1 + y2) / 2 : y2;
      const length = Math.hypot(end - start, y - y1), ux = (end - start) / (length || 1), uy = (y - y1) / (length || 1);
      const tailX = end - (dropped ? 0 : 9 * ux), tailY = y - (dropped ? 0 : 9 * uy);
      const tip = dropped ? `<path class="seq-tip seq-loss" d="M${end - 6} ${y - 6}l12 12m0 -12l-12 12"/>`
        : `<path class="seq-tip" d="M${end} ${y}L${tailX - uy * 4.5} ${tailY + ux * 4.5}L${tailX + uy * 4.5} ${tailY - ux * 4.5}Z"/>`;
      const number = members.length > 1 ? `${members[0] + 1}–${members.at(-1) + 1}` : members[0] + 1;
      const name = `${number} · ${packet.time} · ${labels.get(from)} → ${labels.get(to)} · ${packet.summary}${dropped ? ' · 丢包' : ''}`;
      const line = `x1="${start}" y1="${y1}" x2="${tailX}" y2="${tailY}"`;
      const title = caption(packet), locked = /^(已加密|应用数据|FINISHED|TICKETS|CLOSE_NOTIFY)$/.test(title);
      return `<g class="seq-message${dropped ? ' lost' : ''}" data-seq="${members[0]}" data-tone="${packet.kind.tone}" role="button" tabindex="0" aria-label="${escape(name)}">
        <title>${escape(name)}</title><text class="seq-time" x="64" y="${y1}">${escape(packet.time)}</text>
        <circle class="seq-dot" cx="${start}" cy="${y1}" r="2.6"/><line class="seq-hit" ${line}/><line class="seq-line" ${line}/>${tip}
        <g class="seq-caption"><rect y="-17" height="15" rx="2"/><text y="-6" text-anchor="middle">${escape(title)}</text>${locked ? '<path class="seq-lock" d="M2 -10v-2a2.5 2.5 0 0 1 5 0v2M1 -10h7v5H1Z"/>' : ''}</g></g>`;
    }).join('');
    svg.innerHTML = `<defs><pattern id="seq-wave" width="12" height="20" patternUnits="userSpaceOnUse" y="-10"><path d="M0 4q3 -3 6 0t6 0M0 16q3 -3 6 0t6 0"/></pattern></defs>${life}${pauses}${dividers}${annotations}${messageMarkup}`;
    arrows = [...svg.querySelectorAll('.seq-message')].map(group => {
      const line = group.querySelector('.seq-line');
      return { group, line, length: line.getTotalLength(), tip: group.querySelector('.seq-tip'), label: group.querySelector('.seq-caption') };
    });
    badges = [...svg.querySelectorAll('.seq-note')];
    steps = [...svg.querySelectorAll('.seq-step')];

    function fit(text, max) {
      const original = text.textContent;
      for (let n = original.length - 1; n >= 0 && text.getComputedTextLength() > max; n--) text.textContent = `${original.slice(0, n)}…`;
      return text.getComputedTextLength();
    }
    svg.querySelectorAll('.seq-pill').forEach(rect => {
      const text = rect.nextElementSibling, w = fit(text, Number(rect.dataset.room) || gap - 42) + 16;
      const anchor = text.getAttribute('text-anchor');
      rect.setAttribute('width', w);
      rect.setAttribute('x', anchor === 'middle' ? -w / 2 : anchor === 'end' ? 8 - w : -8);
    });
    const occupied = [];
    arrows.forEach(({ label }, i) => {
      const { from, to, y1, y2, packet } = messages[i], start = x.get(from), lost = packet.outcome === 'dropped';
      const dx = (x.get(to) - start) * (lost ? .5 : 1), dy = (y2 - y1) * (lost ? .5 : 1);
      const rect = label.firstElementChild, text = rect.nextElementSibling;
      const lock = label.querySelector('.seq-lock'), extra = lock ? 14 : 0;
      const w = fit(text, Math.max(32, Math.abs(dx) - 20 - extra)) + 12 + extra;
      if (lock) {
        lock.setAttribute('transform', `translate(${5 - w / 2})`);
        text.setAttribute('x', extra / 2);
      }
      rect.setAttribute('x', -w / 2);
      rect.setAttribute('width', w);
      const angle = Math.atan(dy / (dx || 1)) * 180 / Math.PI;
      const min = Math.min(.5, w / (2 * Math.max(1, Math.abs(dx))));
      const candidates = [.5, .4, .6, .3, .7, .2, .8].filter(f => f >= min && f <= 1 - min);
      const f = candidates.find(f => !occupied.some(([x, y, width]) => Math.abs(x - start - dx * f) < (width + w) / 2 && Math.abs(y - y1 - dy * f) < 16)) ?? .5;
      const cx = start + dx * f, cy = y1 + dy * f;
      occupied.push([cx, cy, w]);
      label.setAttribute('transform', `translate(${cx} ${cy}) rotate(${angle})`);
    });
    select(selected);
    return true;
  }

  function select(index) {
    selected = index;
    arrows.forEach(({ group }, i) => group.classList.toggle('inspected', messages[i].members.includes(index)));
  }

  function render(state, unit, visible, active, visibleEvents, updates) {
    if (root.hidden) return;
    reflow();
    svg.setAttribute('height', Math.max(height, scroll.clientHeight));
    ids.forEach((id, i) => {
      const address = updates.get(id)?.address ?? addresses.get(id) ?? '';
      if (lanes[i].textContent !== address) lanes[i].textContent = lanes[i].title = address;
    });
    let latest = 0;
    steps.forEach((step, i) => step.classList.toggle('current', state.started && !state.finished && i === unit.step));
    badges.forEach((note, i) => {
      const shown = !state.started || visibleEvents.has(notes[i].key);
      note.classList.toggle('pending', !shown);
      if (shown) latest = Math.max(latest, notes[i].y);
    });
    arrows.forEach(({ group }, i) => {
      const { members, y2 } = messages[i], shown = members.some(n => visible[n]);
      group.classList.toggle('pending', !shown);
      group.classList.toggle('current', shown && !state.finished && members.some(n => active.has(n)));
      group.setAttribute('tabindex', shown ? '0' : '-1');
      if (shown) latest = Math.max(latest, y2);
    });
    const top = scroll.scrollTop, view = scroll.clientHeight;
    const target = !state.started ? 0 : latest > top + view - 44 ? latest - view * .62 : latest < top + 30 ? latest - view * .4 : top;
    if (Math.max(0, target) !== top) scroll.scrollTo({ top: target, behavior: state.started && !motion.matches ? 'smooth' : 'instant' });
    if (!state.started && scroll.scrollLeft) scroll.scrollLeft = 0;
  }

  function animate(state, members, flights) {
    arrows.forEach(({ group, line, length, tip, label }, i) => {
      const { members: indices, packet } = messages[i];
      const index = indices.find(n => members.includes(n));
      const quick = lesson.meta.id === 'tls' && packet.protocol === 'TCP' && /^\S+ → \S+ \[(?:SYN(?:, ACK)?|ACK)\]/.test(packet.summary);
      const progress = !state.started || state.finished || index === undefined || motion.matches ? 1
        : Math.min(1, Math.max(0, (state.elapsed - packets[index].leadMs) / Math.min(flights[index] || Infinity, quick ? 320 : 620)));
      const draw = 1 - (1 - progress) ** 3;
      line.style.strokeDasharray = progress < 1 && !group.classList.contains('lost') ? `${draw * length} ${length}` : '';
      line.style.opacity = group.classList.contains('lost') ? draw : 1;
      tip.style.opacity = Math.max(0, Math.min(1, (progress - .7) * 4));
      label.style.opacity = Math.max(0, Math.min(1, (progress - .3) * 2.6));
    });
  }

  return { reflow, render, animate, select };
}
