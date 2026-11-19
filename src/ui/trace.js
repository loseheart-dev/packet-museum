import { $, escape, mobile } from './dom.js';

const ends = ({ path }) => [path[0], path.at(-1)];

export function mountTrace(lesson, packets, labels) {
  $('rows').innerHTML = `<tr id="empty-trace"><td colspan="7">线路上还没有数据包。</td></tr>${packets.map((packet, i) => {
    const [from, to] = ends(packet).map(id => labels.get(id));
    return `<tr data-index="${i}"><td><button type="button" class="packet-number" data-tone="${packet.kind.tone}" aria-label="定位到报文 ${i + 1}：${escape(packet.kind.label)}">${i + 1}</button></td><td>${escape(packet.time)}</td><td>${escape(packet.src ?? from)}</td><td>${escape(packet.dst ?? to)}</td><td>${escape(packet.protocol)}</td><td>${escape(packet.summary)}</td><td>${packet.bytes.length} B</td></tr>`;
  }).join('')}`;
  const rows = [...$('rows').querySelectorAll('[data-index]')];
  const sequence = $('sequence');
  let seqRows = [];

  function drawSequence() {
    const ids = lesson.sequenceNodes ?? lesson.nodes.map(node => node.id).filter(id => packets.some(packet => ends(packet).includes(id)));
    const width = Math.max(mobile.matches ? 360 : 720, ids.length * 64), y0 = 34, gap = mobile.matches ? 31 : 43;
    const inset = mobile.matches ? 39 : 64, stepGap = 21;
    const height = y0 + gap * packets.length + stepGap * lesson.steps.length + 12;
    const x = id => inset + ids.indexOf(id) * (width - inset * 2) / (ids.length - 1);
    const positions = ids.map(id => `<line class="seq-lifeline" x1="${x(id)}" x2="${x(id)}" y1="${y0}" y2="${height - 3}"/><text class="seq-label" x="${x(id)}" y="22">${escape(labels.get(id))}</text>`).join('');
    const markup = packets.map((packet, i) => {
      const [from, to] = ends(packet);
      const y = y0 + 23 + i * gap + stepGap * (packet.step + 1), sign = Math.sign(x(to) - x(from));
      const tip = x(to) - sign * 3, tail = x(to) - sign * 10;
      const title = packet.firstInStep ? `<text class="seq-step" x="10" y="${y - 25}">步骤 ${packet.step + 1} · ${escape(lesson.steps[packet.step].title)}</text>` : '';
      return `${title}<g data-seq="${i}" data-tone="${packet.kind.tone}" class="seq-row" tabindex="0" role="button" aria-label="检查报文 ${i + 1}，${escape(labels.get(from))} → ${escape(labels.get(to))}">
        <rect class="seq-hit" x="0" y="${y - 23}" width="${width}" height="${gap}"/>
        <text class="seq-num" x="6" y="${y + 4}">${escape(packet.time)}</text>
        <line class="seq-arrow" pathLength="1" x1="${x(from) + sign * 4}" x2="${x(to) - sign * 9}" y1="${y}" y2="${y}"/>
        <path class="seq-tip" d="M ${tail} ${y - 4} L ${tip} ${y} L ${tail} ${y + 4} Z"/>
        <text class="seq-caption" x="${(x(from) + x(to)) / 2}" y="${y - 9}">${escape(packet.kind.title)}</text></g>`;
    }).join('');
    sequence.innerHTML = `<svg viewBox="0 0 ${width} ${height}" aria-label="时序图" role="group">${positions}${markup}</svg>`;
    seqRows = [...sequence.querySelectorAll('[data-seq]')];
  }

  function render({ started, index }, visible) {
    const active = started ? Math.min(index, visible) : -1;
    $('empty-trace').hidden = visible >= 0;
    rows.forEach((row, i) => {
      row.hidden = i > visible;
      row.classList.toggle('current', i === active);
      if (i === active) row.setAttribute('aria-current', 'true'); else row.removeAttribute('aria-current');
    });
    const row = rows[active], log = $('log');
    if (row && row.offsetTop + row.offsetHeight > log.scrollTop + log.clientHeight) log.scrollTop = row.offsetTop + row.offsetHeight - log.clientHeight;
    if (row && row.offsetTop < log.scrollTop + 23) log.scrollTop = Math.max(0, row.offsetTop - 23);
    seqRows.forEach((row, i) => {
      row.classList.toggle('pending', i > visible);
      row.classList.toggle('current', i === active);
      row.setAttribute('tabindex', i > visible ? '-1' : '0');
      if (i !== index) {
        row.classList.remove('flying');
        row.querySelector('.seq-arrow').style.strokeDashoffset = 0;
      }
    });
    if (!sequence.hidden && active >= 0) {
      const box = sequence.getBoundingClientRect(), item = seqRows[active].getBoundingClientRect();
      if (item.bottom > box.bottom || item.top < box.top) sequence.scrollTop += item.top - box.top - 64;
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
