import './styles.css';
import { catalog, groups } from './catalog.js';
import { $, escape, mobile } from './ui/dom.js';
import { mountWorkbench } from './ui/workbench.js';

const registry = import.meta.glob('./lessons/*/index.js', { eager: true });
const lessons = new Map(Object.values(registry).map(({ default: lesson }) => [lesson.meta.id, lesson]));
const entries = [...new Map([...catalog, ...Array.from(lessons.values(), lesson => lesson.meta)].map(meta => [meta.id, meta])).values()]
  .sort((a, b) => a.group - b.group || a.order - b.order);
const routeFor = id => `#/lesson/${id}`;
const layerNames = ['物理层', '数据链路层', '网络层', '传输层', '会话层', '表示层', '应用层'];
let current, workbench, expanded = true, group = 0, layer = 0;

$('osi').insertAdjacentHTML('beforeend', layerNames.map((name, i) => `<button type="button" aria-label="第 ${i + 1} 层：${name}" data-layer="${i + 1}">${i + 1}</button>`).join(''));
$('filters').innerHTML = groups.map((name, i) => `<button type="button" data-group="${i}">${name} ${i ? entries.filter(entry => entry.group === i).length : entries.length}</button>`).join('');

function catalogMarkup(lesson) {
  return entries.map(({ id, title, subtitle }) => {
    const available = lessons.has(id), active = id === lesson?.meta.id;
    const label = `<span class="course-symbol" aria-hidden="true">${available ? '●' : '○'}</span><span><b>${escape(title)}</b><small>${escape(subtitle)}</small></span>`;
    const link = available ? `<a href="${escape(routeFor(id))}" class="course-title">${label}</a>` : `<div class="course-title" aria-disabled="true">${label}</div>`;
    if (!active) return `<li class="course">${link}</li>`;
    const steps = lesson.steps.map(({ title, subtitle }, i) => `<li style="--step-index:${i}"><button type="button" data-step="${i}"><span class="step-num" aria-hidden="true"><span>${i + 1}</span><svg viewBox="0 0 12 12" width="11" height="11"><path pathLength="1" d="m2 6 2.5 2.5 5.5-5.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span class="step-text"><span class="step-title">${escape(title)}</span>${subtitle ? `<small>${escape(subtitle)}</small>` : ''}</span></button></li>`).join('');
    return `<li class="course"><button type="button" class="course-title current" id="active-course" aria-controls="steps">${label}<span id="course-chevron" class="chevron" aria-hidden="true"></span></button><div class="steps-wrap"><div class="steps-clip"><ol class="steps" id="steps">${steps}</ol></div></div></li>`;
  }).join('');
}

function renderCatalog() {
  const query = $('search').value.trim().toLowerCase();
  const list = current ? $('courses') : $('route-courses');
  let count = 0;
  [...list.children].forEach((item, i) => {
    const entry = entries[i];
    item.hidden = Boolean(group && group !== entry.group || layer && layer !== entry.layer || !`${entry.title} ${entry.subtitle}`.toLowerCase().includes(query));
    if (!item.hidden) count++;
  });
  if (current) {
    $('no-results').hidden = count > 0;
    $('steps').inert = !expanded;
    $('active-course').setAttribute('aria-expanded', expanded);
    $('course-chevron').textContent = expanded ? '⌄' : '›';
  } else $('route-no-results').hidden = count > 0 || $('route-courses').hidden;
  for (const button of $('filters').children) button.setAttribute('aria-pressed', Number(button.dataset.group) === group);
  for (const button of $('osi').querySelectorAll('button')) {
    button.setAttribute('aria-pressed', Number(button.dataset.layer) === layer);
    button.classList.toggle('course-level', !layer && Number(button.dataset.layer) === current?.meta.layer);
  }
}

function route(focus = false) {
  const hash = location.hash;
  const match = /^#\/lesson\/([a-z][a-z0-9-]*)(?:\/([a-z][a-z0-9-]*))?$/.exec(hash);
  const lesson = lessons.get(hash ? match?.[1] : 'dns');
  const notFound = hash && hash !== '#/' && !lesson;
  if ($('drawer').open) $('drawer').close();
  workbench?.destroy(); workbench = undefined;
  current = lesson;
  for (const element of document.querySelectorAll('.grid > :not(#route-empty)')) element.hidden = !lesson;
  $('route-empty').hidden = Boolean(lesson);
  $('catalog').hidden = !lesson;
  $('layout').hidden = $('open-catalog').hidden = !lesson;
  if (lesson) {
    expanded = true;
    $('courses').innerHTML = catalogMarkup(lesson);
    workbench = mountWorkbench(lesson);
    if (match?.[2]) workbench.jumpTo(match[2]);
    if (focus) $('show-network').focus({ preventScroll: true });
  } else {
    $('route-title').textContent = notFound ? '找不到此课程' : '互联网协议';
    $('route-courses').innerHTML = notFound ? '' : catalogMarkup();
    $('route-courses').hidden = Boolean(notFound);
    $('back-catalog').hidden = !notFound;
    if (focus) $('route-title').focus();
  }
  renderCatalog();
}

function moveCatalog() {
  if ($('drawer').open) $('drawer').close();
  $(mobile.matches ? 'drawer' : 'side').append($('catalog'));
}
mobile.addEventListener('change', moveCatalog);
window.addEventListener('hashchange', () => route(true));
$('search').addEventListener('input', renderCatalog);
$('search').addEventListener('keydown', e => { if (e.key === 'Enter' && mobile.matches && current && !$('drawer').open) $('open-catalog').click(); });
$('courses').addEventListener('click', e => { if (e.target.closest('#active-course')) { expanded = !expanded; renderCatalog(); } });
$('filters').addEventListener('click', e => { if (e.target.dataset.group !== undefined) { group = Number(e.target.dataset.group); renderCatalog(); } });
$('osi').addEventListener('click', e => { const val = Number(e.target.dataset.layer); if (val) { layer = layer === val ? 0 : val; renderCatalog(); } });
$('open-catalog').addEventListener('click', () => {
  $('drawer').showModal();
  if (!$('active-course').parentElement.hidden) ($(expanded ? 'steps' : 'active-course')).scrollIntoView({ block: 'nearest' });
});
$('close-catalog').addEventListener('click', () => $('drawer').close());
$('layout').addEventListener('click', () => $('layout').setAttribute('aria-pressed', $('app').classList.toggle('wide')));
$('theme').addEventListener('click', () => {
  const root = document.documentElement;
  root.dataset.theme = (root.dataset.theme ?? root.dataset.base) === 'light' ? 'dark' : 'light';
  $('theme').title = $('theme').ariaLabel = root.dataset.theme === 'light' ? '深色模式' : '浅色模式';
});
moveCatalog(); route();
