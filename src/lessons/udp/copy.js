// Lesson copy from the reference bundle's UDP definition; the catalog uses the saved zh snapshot.
export const overview = {
  title: 'UDP', subtitle: 'User Datagram Protocol',
  text: 'UDP sends data in independent packets called datagrams, with no connection, no acknowledgements and no resends. That keeps it fast and light: right for voice, video, games and DNS, where a late answer is worse than a missing one.',
  facts: [['Layer', 'Transport (Layer 4)'], ['Connection', 'None'], ['Reliability', 'None (no ACKs, no resends)'], ['Ordering', 'Not guaranteed'], ['Header', '8 bytes'], ['Defined In', 'RFC 768']],
};

export const steps = [
  {
    id: 'send', title: 'Send Right Away', subtitle: 'No handshake, data goes first',
    text: 'A call app already knows the media server’s address and port from signing in. It doesn’t open a connection: the very first datagram already carries 20 ms of your voice, behind an 8-byte UDP header.',
    facts: [['Setup', 'None'], ['Header', '8 bytes'], ['Ports', '50000 → 5004']],
  },
  {
    id: 'stream', title: 'A Stream of Datagrams', subtitle: 'One every 20 ms, each on its own',
    text: 'The app keeps sending a datagram every 20 ms. Each one stands alone, with its own header and no link to the others. UDP doesn’t number them, and nothing comes back to confirm they arrived.',
    facts: [['Rate', '1 datagram / 20 ms'], ['Numbering', 'None in UDP itself'], ['Confirmation', 'None (no ACKs)']],
  },
  {
    id: 'loss', title: 'Lost on the Way', subtitle: 'Nobody resends it',
    text: 'Frame 7 is dropped somewhere on the internet. The media server never asks for it, and UDP never tells the laptop: there are no acknowledgements to miss. The datagrams after it arrive as normal.',
    facts: [['Lost', 'Voice frame 7'], ['Resent', 'Never (no ACKs)'], ['Missing', '20 ms of audio']],
  },
  {
    id: 'reply', title: 'Replies Come Back', subtitle: 'The other voice comes back',
    text: 'The other person’s voice arrives the same way, as separate datagrams sent to port 50000. They get back in because your router remembered the outgoing port when it translated your address (NAT).',
    facts: [['Ports', '5004 → 50000'], ['Direction', 'Independent of ours'], ['Through NAT', 'Router remembers the port']],
  },
];

// shortcut: the note-only fifth step shares the outro until the player supports steps without frames.
export const outro = {
  title: 'The App Decides', subtitle: 'Reliability is up to the app',
  text: 'The call app numbers its own frames (RTP does this), so it sees that frame 7 is missing and smooths over the 20 ms gap instead of waiting. Waiting for a resend would make the whole call lag. '
    + 'Audio started with the very first packet, every datagram travelled on its own, and the one that was lost was simply gone: UDP never noticed. The app covered the gap and the call carried on. Press REPLAY to watch it again.',
  facts: [['Ordering', 'App’s job (e.g. RTP)'], ['Loss', 'Hidden by the app'], ['Also on UDP', 'DNS, games, QUIC'],
    ['Datagrams', '11 (1 lost, never resent)'], ['Setup time', '0 ms (no handshake)'], ['Header', '8 bytes (TCP: 20+)'], ['Shown', 'The first 0.2 s of a call']],
};
