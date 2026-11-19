export function lessonTimeline(steps, packets, flights) {
  const units = [], stepStarts = [], packetUnits = [];
  let first = 0;
  steps.forEach(({ frames = [], parallel, holdMs, events = [] }, step) => {
    stepStarts.push(units.length);
    const groups = new Map((parallel ?? []).map(group => [group[0], group.length]));
    const last = first + frames.length;
    do {
      const count = first < last ? groups.get(packets[first].id) ?? 1 : 0;
      const members = Array.from({ length: count }, (_, i) => first + i);
      const start = units.length === stepStarts[step];
      const leadMs = members.length ? Math.min(...members.map(i => packets[i].leadMs)) : 0;
      const flight = Math.max(0, ...members.map(i => packets[i].leadMs - leadMs + flights[i]));
      const duration = members.length ? Math.max(...members.map(i => packets[i].leadMs + flights[i] + packets[i].holdMs)) : holdMs ?? 2200;
      const eventEnd = start ? Math.max(0, ...events.map(event => event.atMs ?? 0)) : 0;
      units.push({ step, start, members, leadMs, flight, holdMs: Math.max(duration, eventEnd + (eventEnd ? 400 : 0)) - leadMs - flight });
      for (const i of members) packetUnits[i] = units.length - 1;
      first += members.length;
    } while (first < last);
  });
  const stepElapsed = [0];
  units.forEach((unit, i) => { stepElapsed[i] = unit.start ? 0 : stepElapsed[i - 1] + units[i - 1].leadMs + units[i - 1].flight + units[i - 1].holdMs; });
  return { units, stepStarts, packetUnits, stepElapsed };
}

export function createPlayback(units, flights = units.map(unit => unit.flight)) {
  const count = units.length;
  const duration = i => units[i].leadMs + flights[i] + units[i].holdMs;
  const state = { index: 0, elapsed: 0, started: false, finished: false, running: false };
  const reset = () => Object.assign(state, { index: 0, elapsed: 0, started: false, finished: false, running: false });
  const pause = () => { state.running = false; };
  const play = () => {
    if (state.finished) reset();
    state.started = state.running = true;
  };
  function jump(i, atStart = false) {
    const index = Math.max(0, Math.min(count - 1, i));
    Object.assign(state, { index, elapsed: atStart ? 0 : units[index].leadMs + flights[index], started: true, finished: false, running: false });
  }
  function advance(ms) {
    if (!state.running) return;
    state.elapsed += ms;
    while (state.elapsed >= duration(state.index)) {
      if (state.index === count - 1) {
        state.elapsed = duration(state.index);
        state.running = false;
        state.finished = true;
        return;
      }
      state.elapsed -= duration(state.index++);
    }
  }
  const progress = () => flights[state.index] ? Math.max(0, Math.min(1, (state.elapsed - units[state.index].leadMs) / flights[state.index])) : 1;
  const revealed = () => state.started ? state.index - (state.elapsed < units[state.index].leadMs ? 1 : 0) : count - 1;
  return { state, reset, pause, play, jump, advance, progress, revealed };
}
