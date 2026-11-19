import { hex } from '../lib/bytes/core.js';
import { $, escape, mobile } from './dom.js';

export function mountInspector(on, labels) {
  const fields = $('fields'), dump = $('dump');
  let selected = null;
  let offsets = [];

  function highlight(button, scroll = true) {
    selected?.classList.remove('selected');
    selected = button;
    selected?.classList.add('selected');
    const start = Number(button?.dataset.start), end = start + Number(button?.dataset.length);
    let first;
    offsets.forEach((spans, i) => {
      const active = i >= start && i < end;
      for (const span of spans) span.classList.toggle('selected', active);
      if (active) first ??= spans[0];
    });
    if (first && scroll) {
      const byte = first.getBoundingClientRect(), area = dump.getBoundingClientRect();
      if (byte.top < area.top || byte.bottom > area.bottom) dump.scrollTop += byte.top - area.top - 8;
    }
  }

  function render(packet) {
    const { bytes, layers, kind, time, path, protocol } = packet;
    $('frame-head').textContent = `${kind.title} · ${time} · ${packet.src ?? labels.get(path[0])} → ${packet.dst ?? labels.get(path.at(-1))} · ${protocol} · ${bytes.length} B`;
    $('layers').innerHTML = layers.map(({ label, length, color }, i) => `<button type="button" data-group="${i}" style="flex:${length} 1 49px;--layer:var(--${color})"><b>${label}</b><small>${length} B</small></button>`).join('');
    fields.innerHTML = layers.map(({ label, color, fields }, i) => `<section id="group-${i}"><h3 style="--layer:var(--${color})">${label} · ${layers[i].length} 字节</h3>${fields.map(({ label, offset, length, value }) => `<button type="button" class="field" data-start="${offset}" data-length="${length}"><b>${escape(label)}</b><code>${escape(value)}</code></button>`).join('')}</section>`).join('');
    const lines = [], width = mobile.matches ? 5 : 8;
    for (let i = 0; i < bytes.length; i += width) {
      const slice = Array.from(bytes.subarray(i, i + width));
      const col = format => slice.map((n, j) => `<span class="byte" data-byte="${i + j}">${format(n)}</span>`).join('');
      lines.push(`<div class="dump-line"><span class="offset">${hex(i, 4)}</span><span>${col(n => hex(n))}</span><span class="ascii">${col(n => n < 32 || n > 126 ? '.' : escape(String.fromCharCode(n)))}</span></div>`);
    }
    dump.innerHTML = lines.join('');
    offsets = Array.from(bytes, () => []);
    dump.querySelectorAll('[data-byte]').forEach(span => offsets[span.dataset.byte].push(span));
    fields.scrollTop = dump.scrollTop = 0;
    selected = null;
  }

  on($('layers'), 'click', e => {
    const i = e.target.closest('[data-group]')?.dataset.group;
    if (i === undefined) return;
    const group = $(`group-${i}`);
    fields.scrollTop += group.getBoundingClientRect().top - fields.getBoundingClientRect().top;
    const first = group.querySelector('.field');
    first?.focus({ preventScroll: true });
    highlight(first);
  });
  on(fields, 'pointerover', e => { const button = e.target.closest('.field'); if (button && button !== selected) highlight(button); });
  on(fields, 'pointerleave', () => highlight(document.activeElement.closest('.field')));
  on(fields, 'focusin', e => highlight(e.target.closest('.field')));
  on(fields, 'focusout', e => { if (!fields.contains(e.relatedTarget)) highlight(null); });
  on(dump, 'click', e => {
    const byte = e.target.closest('[data-byte]');
    if (!byte) return;
    const n = Number(byte.dataset.byte);
    const field = [...fields.querySelectorAll('.field')].find(button => n >= Number(button.dataset.start) && n < Number(button.dataset.start) + Number(button.dataset.length));
    if (!field) return;
    field.focus({ preventScroll: true });
    fields.scrollTop += field.getBoundingClientRect().top - fields.getBoundingClientRect().top;
    highlight(field, false);
  });

  return render;
}
