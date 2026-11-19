import { $, escape } from './dom.js';
import { mountSequence } from './sequence.js';

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
  const sequence = mountSequence(lesson, packets, labels, entries);
  const log = $('log');
  const follow = row => {
    if (!row || row.hidden) return;
    if (row.offsetTop + row.offsetHeight > log.scrollTop + log.clientHeight) log.scrollTop = row.offsetTop + row.offsetHeight - log.clientHeight;
    if (row.offsetTop < log.scrollTop + 23) log.scrollTop = Math.max(0, row.offsetTop - 23);
  };

  function render(visible, active) {
    $('empty-trace').hidden = visible.some(Boolean);
    rows.forEach((row, i) => {
      const members = entries[i].members;
      row.hidden = !members.some(n => visible[n]);
      const current = members.some(n => active.has(n) && visible[n]);
      row.classList.toggle('current', current);
      if (current) row.setAttribute('aria-current', 'true'); else row.removeAttribute('aria-current');
    });
    follow(rows.find(item => item.classList.contains('inspected')) ?? rows.find(item => item.classList.contains('current')));
  }

  function select(index) {
    sequence.select(index);
    rows.forEach((row, i) => row.classList.toggle('inspected', entries[i].members.includes(index)));
    follow(rows.find(row => row.classList.contains('inspected')));
  }

  return { render, select, sequence };
}
