export function createPlayback(packets, flights) {
  const count = packets.length;
  const duration = i => packets[i].leadMs + flights[i] + packets[i].holdMs;
  const state = { index: 0, elapsed: 0, started: false, finished: false, running: false };
  const reset = () => Object.assign(state, { index: 0, elapsed: 0, started: false, finished: false, running: false });
  const pause = () => { state.running = false; };
  const play = () => {
    if (state.finished) reset();
    state.started = state.running = true;
  };
  function jump(i, atStart = false) {
    const index = Math.max(0, Math.min(count - 1, i));
    Object.assign(state, { index, elapsed: atStart ? 0 : packets[index].leadMs + flights[index], started: true, finished: false, running: false });
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
  const progress = () => Math.max(0, Math.min(1, (state.elapsed - packets[state.index].leadMs) / flights[state.index]));
  const revealed = () => state.started ? state.index - (state.elapsed < packets[state.index].leadMs ? 1 : 0) : count - 1;
  return { state, reset, pause, play, jump, advance, progress, revealed };
}
