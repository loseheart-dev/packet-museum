const latencyMs = {
  dns: { 'client-resolver': 12, 'resolver-root': 5, 'resolver-tld': 10, 'resolver-auth': 20 },
  http: { 'client-resolver': 12, 'client-web': 17 },
  tcp: { 'client-web': 17 }, tls: { 'client-web': 17 }, dhcp: { 'client-router': 1 },
};

const ms = value => Math.round(parseFloat(value) * 1e6) / 1000;

export function sequenceLanes(width, ids) {
  const axis = 78, end = 30;
  width = Math.max(width, axis + end + ids.length * 124);
  const gap = (width - axis - end) / ids.length;
  return { width, gap, positions: new Map(ids.map((id, i) => [id, Math.round(axis + gap * (i + .5))])) };
}

export function sequenceLayout(lesson, packets, entries) {
  const delays = latencyMs[lesson.meta.id] ?? {};
  let index = 0;
  const stepByPacket = new Map(lesson.steps.flatMap(({ frames = [] }, step) => frames.map(() => [index++, step])));
  const messages = entries.map(({ members, packet }) => {
    const from = packet.path[0], to = packet.path.at(-1), sent = ms(packet.time);
    // shortcut: use the minimum visual slope for lessons without measured link delays; add delays when those lessons are measured.
    const delay = delays[`${from}-${to}`] ?? delays[`${to}-${from}`] ?? 3;
    return { members, packet, from, to, sent, arrival: sent + delay, step: stepByPacket.get(members[0]) };
  });
  const byFrame = new Map(messages.flatMap(message => message.members.map(i => [packets[i].id, message])));
  const items = messages.flatMap(message => [
    { time: message.sent, type: 2, message, step: message.step },
    { time: message.arrival, type: 0, message },
  ]);
  const headings = [], notes = [], breaks = [];
  let previous;
  lesson.steps.forEach(({ events = [] }, step) => {
    const own = messages.filter(message => message.step === step);
    const next = messages.find(message => message.step > step);
    for (const [i, event] of events.entries()) {
      const after = byFrame.get(event.after);
      const time = Math.max(after?.arrival ?? previous?.arrival ?? 0, ms(event.time) || 0, after ? 0 : own[0]?.sent ?? 0);
      const note = { ...event, key: `${step}:${i}`, from: after?.from ?? previous?.from, to: after?.to ?? previous?.to };
      items.push({ time, type: 1, note, step });
      notes.push(note);
    }
    if (!own.length && !events.length) items.push({ time: previous?.arrival ?? next?.sent ?? 0, type: 1, step });
    previous = own.at(-1) ?? previous;
  });
  items.sort((a, b) => a.time - b.time || a.type - b.type || (a.step ?? 0) - (b.step ?? 0));
  let y = 30, last, lastSend = -Infinity, lastNote = -Infinity;
  for (const item of items) {
    if (last) {
      const delta = item.time - last.time;
      if (delta > 250) { breaks.push({ y: y + 29, ms: delta }); y += 58; }
      else if (delta > 0) y += Math.max(9, delta * 3);
      else if (item.type === 0 && last.type === 0) y += 18;
    }
    if (item.type === 2) y = Math.max(y, lastSend + 30, lastNote + 22);
    if (item.step !== undefined && headings[item.step] === undefined) { headings[item.step] = y + 15; y += 30; }
    if (item.note) { item.note.y = y + 15; lastNote = y + 25; y += 30; }
    if (item.type === 2) item.message.y1 = lastSend = y;
    if (item.type === 0) item.message.y2 = y;
    last = item;
  }
  return { headings, messages, notes, breaks, height: y + 40 };
}
