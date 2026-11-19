import { $, escape, mobile } from './dom.js';

const ends = ({ path }) => [path[0], path.at(-1)];

export function mountTrace(lesson, packets, labels, groups) {
  const grouped = new Map(groups.filter(group => !group.separateRows).flatMap(group => group.members.map(i => [i, group])));
  const entries = packets.flatMap((packet, i) => {
    const group = grouped.get(i);
    return group ? group.members[0] === i ? [group] : [] : [{ members: [i], packet }];
  });
  const showMac = Boolean(lesson.linkAddresses);
  document.querySelectorAll('[data-link-address]').forEach(col => { col.hidden = !showMac; });
  $('rows').innerHTML = `<tr id="empty-trace"><td colspan="${showMac ? 9 : 7}">线路上还没有数据包。</td></tr>${entries.map(({ members, packet }, row) => {
    const i = members[0], number = row + 1;
    const [from, to] = ends(packet).map(id => labels.get(id));
    const mac = showMac ? `<td>${escape(packet.link?.src ?? '—')}</td><td>${escape(packet.link?.dst ?? '—')}</td>` : '';
    const bytes = members.reduce((sum, n) => sum + packets[n].bytes.length, 0);
    const length = members.length > 1 && bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`;
    return `<tr data-index="${i}"><td><button type="button" class="packet-number" data-tone="${packet.kind.tone}" aria-label="定位到第 ${number} 行：${escape(packet.kind.label)}">${number}</button></td><td>${escape(packet.time)}</td><td>${escape(packet.src ?? from)}</td><td>${escape(packet.dst ?? to)}</td>${mac}<td>${escape(packet.protocol)}</td><td>${escape(packet.summary)}</td><td title="${bytes} B">${length}</td></tr>`;
  }).join('')}`;
  const rows = [...$('rows').querySelectorAll('[data-index]')];
  const sequence = $('sequence');
  let seqRows = [], events = [], headings = [];

  function drawSequence() {
    const ids = lesson.sequenceNodes ?? lesson.nodes.map(node => node.id).filter(id => packets.some(packet => ends(packet).includes(id)));
    const width = Math.max(mobile.matches ? 360 : 720, ids.length * 64);
    const start = lesson.timeColumn ? (mobile.matches ? 66 : 103) : (mobile.matches ? 39 : 64), end = mobile.matches ? 32 : 61;
    const y0 = 35, gap = mobile.matches ? 32 : 43;
    const x = id => start + ids.indexOf(id) * (width - start - end) / Math.max(1, ids.length - 1);
    let y = y0, i = 0;
    const markup = lesson.steps.map(({ title, frames = [], events: notes = [] }, step) => {
      y += 20;
      let html = `<text data-heading="${step}" class="seq-step" x="10" y="${y}">步骤 ${step + 1} · ${escape(title)}</text>`;
      const annotations = after => notes.map((note, j) => {
        if (note.after !== after) return '';
        y += 22;
        const at = ids.includes(note.node) ? x(note.node) : note.node ? width / 2 : start;
        return `<g data-event="${step}:${j}"><text class="seq-num" x="6" y="${y}">${escape(note.time ?? '')}</text><text class="seq-event" text-anchor="${at > width * .75 ? 'end' : 'start'}" x="${at}" y="${y}">${escape(note.text)}</text></g>`;
      }).join('');
      html += annotations(undefined);
      for (const id of frames) {
        const packet = packets[i], n = i++;
        const [from, to] = ends(packet);
        y += gap;
        const sign = Math.sign(x(to) - x(from)), dropped = packet.outcome === 'dropped';
        const tip = dropped ? x(from) + .59 * (x(to) - x(from)) : x(to) - sign * 3, tail = tip - sign * 7;
        const marker = dropped ? `<text class="seq-tip seq-loss" x="${tip}" y="${y + 4}">× 丢包</text>` : `<path class="seq-tip" d="M ${tail} ${y - 4} L ${tip} ${y} L ${tail} ${y + 4} Z"/>`;
        html += `<g data-seq="${n}" data-tone="${packet.kind.tone}" class="seq-row" tabindex="0" role="button" aria-label="检查报文 ${n + 1}，${escape(labels.get(from))} → ${escape(labels.get(to))}${dropped ? '，丢包' : ''}">
          <rect class="seq-hit" x="0" y="${y - 22}" width="${width}" height="${gap - 3}"/>
          <text class="seq-num" x="6" y="${y + 4}">${escape(packet.time)}</text>
          <line class="seq-arrow" pathLength="1" x1="${x(from) + sign * 4}" x2="${tail}" y1="${y}" y2="${y}"/>${marker}
          <text class="seq-caption" x="${(x(from) + tip) / 2}" y="${y - 9}">${escape(packet.kind.title)}</text></g>${annotations(id)}`;
      }
      return html;
    }).join('');
    const height = y + 20;
    const positions = ids.map(id => `<line class="seq-lifeline" x1="${x(id)}" x2="${x(id)}" y1="${y0}" y2="${height - 3}"/><text class="seq-label" x="${x(id)}" y="22">${escape(labels.get(id))}</text>`).join('');
    sequence.innerHTML = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-label="时序图" role="group">${lesson.timeColumn ? `<text class="seq-num" x="6" y="22">时间</text><line class="seq-lifeline" x1="${start - 25}" x2="${start - 25}" y1="8" y2="${height - 3}"/>` : ''}${positions}${markup}</svg>`;
    seqRows = [...sequence.querySelectorAll('[data-seq]')];
    events = [...sequence.querySelectorAll('[data-event]')];
    headings = [...sequence.querySelectorAll('[data-heading]')];
  }

  function render({ started }, unit, visible, active, visibleEvents) {
    $('empty-trace').hidden = visible.some(Boolean);
    rows.forEach((row, i) => {
      const members = entries[i].members;
      row.hidden = !members.some(n => visible[n]);
      const current = members.some(n => active.has(n) && visible[n]);
      row.classList.toggle('current', current);
      if (current) row.setAttribute('aria-current', 'true'); else row.removeAttribute('aria-current');
    });
    headings.forEach((heading, i) => heading.classList.toggle('pending', started && i > unit.step));
    events.forEach(event => event.classList.toggle('pending', started && !visibleEvents.has(event.dataset.event)));
    seqRows.forEach((row, i) => {
      row.classList.toggle('pending', !visible[i]);
      row.classList.toggle('current', active.has(i) && visible[i]);
      row.setAttribute('tabindex', visible[i] ? '0' : '-1');
      if (!active.has(i)) progress(i, 1, false);
    });
    const row = rows.find(item => item.classList.contains('current')), log = $('log');
    if (row && row.offsetTop + row.offsetHeight > log.scrollTop + log.clientHeight) log.scrollTop = row.offsetTop + row.offsetHeight - log.clientHeight;
    if (row && row.offsetTop < log.scrollTop + 23) log.scrollTop = Math.max(0, row.offsetTop - 23);
    const item = seqRows[[...active].find(i => visible[i])] ?? headings[unit.step];
    if (started && !sequence.hidden) {
      const box = sequence.getBoundingClientRect(), rect = item.getBoundingClientRect();
      if (rect.bottom > box.bottom || rect.top < box.top) sequence.scrollTop += rect.top - box.top - 64;
    }
  }

  function progress(index, fraction, moving) {
    const row = seqRows[index];
    row.querySelector('.seq-arrow').style.strokeDashoffset = moving ? 1 - fraction : 0;
    row.classList.toggle('flying', moving && fraction < 1);
  }

  drawSequence();
  return { drawSequence, render, progress };
}
