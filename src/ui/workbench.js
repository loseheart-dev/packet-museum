import { inspectFrame } from '../lib/bytes/index.js';
import { createPlayback } from '../playback.js';
import { $, escape, facts, mobile, motion } from './dom.js';
import { mountInspector } from './inspector.js';
import { mountScene } from './scene.js';
import { mountTrace } from './trace.js';

export function mountWorkbench(lesson) {
  const scope = new AbortController();
  const on = (target, event, handler) => target.addEventListener(event, handler, { signal: scope.signal });
  const labels = new Map(lesson.nodes.map(node => [node.id, node.label]));
  const byId = new Map(lesson.frames.map(frame => [frame.id, frame]));
  const legend = lesson.legend ?? { packet: { label: '报文', tone: 'query' } };
  const packets = lesson.steps.flatMap(({ frames }, step) => frames.map((id, i) => {
    const frame = byId.get(id);
    const { label, title = label, tone } = legend[frame.category ?? 'packet'];
    return { leadMs: 900, holdMs: 840, badge: [frame.summary], ...frame, ...inspectFrame(frame), step, firstInStep: i === 0, kind: { label, title, tone } };
  }));
  const stepStarts = lesson.steps.map(({ frames }) => packets.findIndex(packet => packet.id === frames[0]));
  $('canvas').hidden = false;
  const scene = mountScene(lesson, packets);
  const playback = createPlayback(packets, scene.flights);
  const { state } = playback;
  const trace = mountTrace(lesson, packets, labels);
  const renderBytes = mountInspector(on, labels);
  let frame = null, last = null, view = 'network', inspected = 0, visible = -2;
  const overview = lesson.overview;
  $('overview-card').innerHTML = `<h3>${escape(overview.title)}</h3>${overview.subtitle ? `<p class="subtitle">${escape(overview.subtitle)}</p>` : ''}<p>${escape(overview.text)}</p><dl class="facts">${facts(overview.facts)}</dl>`;
  $('packet-key').innerHTML = Object.values(legend).map(({ label, tone }) => `<li data-tone="${tone}">${escape(label)}</li>`).join('');

  function showDetails(show) {
    $('overview-card').hidden = show;
    $('detail-card').hidden = $('show-overview').hidden = !show;
    $('knowledge-title').textContent = show ? state.finished ? '课程总结' : '步骤详情' : '协议概览';
  }

  function updatePlay() { $('play').textContent = state.running ? '暂停' : state.finished ? '重播' : '播放'; }

  function renderTrace() {
    visible = playback.revealed();
    trace.render(state, visible);
  }

  function paint() {
    if (visible !== playback.revealed()) renderTrace();
    const progress = playback.progress();
    if (view === 'network') scene.paint(state, progress);
    if (view === 'sequence') trace.progress(state.index, progress, state.started && !motion.matches);
  }

  function render(snap = false, previousStep) {
    const packet = packets[state.index], { step } = packet;
    scene.setPacket(packet, state);
    scene.aim(state, snap);
    if (previousStep !== step || state.finished) {
      const { title, subtitle, text, facts: items } = state.finished && lesson.outro ? lesson.outro : lesson.steps[step];
      $('step-stamp').textContent = state.finished ? '课程完成' : `步骤 ${step + 1} / ${lesson.steps.length}`;
      $('step-title').textContent = title;
      $('step-subtitle').textContent = subtitle ?? '';
      $('step-text').textContent = text;
      $('step-facts').innerHTML = facts(items);
      for (const button of $('steps').querySelectorAll('button')) {
        const i = Number(button.dataset.step), done = i < step;
        button.classList.toggle('done', done);
        button.querySelector('.step-num').textContent = done ? '✓' : i + 1;
        button.setAttribute('aria-label', `步骤 ${i + 1}：${lesson.steps[i].title}${done ? '，已完成' : ''}`);
        if (state.started && i === step) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current');
      }
    }
    renderTrace(); paint();
    $('prev').disabled = !state.started || state.index === 0;
    $('next').disabled = state.started && state.index === packets.length - 1;
    updatePlay();
  }

  function pause() {
    playback.pause();
    cancelAnimationFrame(frame);
    frame = last = null;
    updatePlay();
  }

  function tick(now) {
    const previous = state.index;
    if (last !== null) playback.advance(Math.min(now - last, 100) * Number($('rate').value));
    last = now;
    if (state.finished) {
      pause(); render(true);
      if (!$('detail-card').hidden) showDetails(true);
      return;
    }
    if (previous !== state.index) render(false, packets[previous].step); else paint();
    frame = requestAnimationFrame(tick);
  }

  function play() {
    if (state.running) { pause(); return; }
    const fresh = !state.started || state.finished;
    playback.play();
    showDetails(true);
    if (fresh) render(); else updatePlay();
    frame = requestAnimationFrame(tick);
  }

  function setView(next, focus = false, packet = state.index) {
    if (next === 'packet' && view !== 'packet') pause();
    view = next;
    $('canvas').hidden = next !== 'network';
    $('sequence').hidden = next !== 'sequence';
    $('packet-view').hidden = next !== 'packet';
    for (const name of ['network', 'sequence', 'packet']) $(`show-${name}`).setAttribute('aria-pressed', next === name);
    if (next === 'packet') { inspected = packet; renderBytes(packets[inspected]); }
    else {
      if (next === 'network') scene.aim(state, !state.running);
      renderTrace(); paint();
    }
    if (focus) $(`show-${next}`).focus();
  }

  function jump(i, autoplay = false) {
    pause(); playback.jump(i, autoplay);
    showDetails(true); render(!autoplay);
    if (view === 'packet') { inspected = state.index; renderBytes(packets[inspected]); }
    if (autoplay) play();
  }

  on($('steps'), 'click', e => {
    const button = e.target.closest('[data-step]');
    if (!button) return;
    if ($('drawer').open) $('drawer').close();
    if (view === 'packet') setView('network');
    jump(stepStarts[Number(button.dataset.step)], true);
  });
  on($('rows'), 'click', e => {
    const row = e.target.closest('[data-index]');
    if (row) jump(Number(row.dataset.index));
  });
  for (const name of ['network', 'sequence', 'packet']) on($(`show-${name}`), 'click', () => setView(name));
  on($('show-overview'), 'click', () => { showDetails(false); $('knowledge-title').focus(); });
  const inspect = () => setView('packet', true);
  on($('packet'), 'click', inspect);
  on($('packet'), 'keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inspect(); } });
  function inspectSequence(e) {
    const row = e.target.closest('[data-seq]');
    if (row) { e.preventDefault(); setView('packet', true, Number(row.dataset.seq)); }
  }
  on($('sequence'), 'click', inspectSequence);
  on($('sequence'), 'keydown', e => { if (e.key === 'Enter' || e.key === ' ') inspectSequence(e); });
  on($('play'), 'click', play);
  on($('prev'), 'click', () => jump(state.index - 1));
  const next = () => jump(state.started ? state.index + 1 : 0);
  on($('next'), 'click', next);
  on($('reset'), 'click', () => { pause(); playback.reset(); showDetails(false); render(true); if (view === 'packet') setView('packet'); });
  on(mobile, 'change', () => { trace.drawSequence(); renderTrace(); if (view === 'packet') renderBytes(packets[inspected]); });
  on(motion, 'change', paint);
  on(document, 'visibilitychange', () => { if (document.hidden && state.running) pause(); });
  on(document, 'keydown', e => {
    if (e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey || $('drawer').open || e.target.closest('input,select,textarea')) return;
    if (e.key === ' ' && !e.target.closest('button,a,[role=button]')) { e.preventDefault(); play(); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); if (e.key === 'ArrowRight') next(); else if (state.started) jump(state.index - 1); }
  });

  const resize = new ResizeObserver(() => { if (view === 'network') { scene.aim(state, !state.running); paint(); } });
  resize.observe($('network-svg'));
  setView('network'); showDetails(false); render(true);
  return {
    jumpTo(id) { const index = lesson.steps.findIndex(step => step.id === id); if (index >= 0) jump(stepStarts[index]); },
    destroy() { pause(); resize.disconnect(); scope.abort(); },
  };
}
