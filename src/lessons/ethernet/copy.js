export const overview = {
  title: 'Ethernet and Switches',
  text: 'Ethernet carries almost every wired network, and Wi-Fi access points pass their traffic on to it. Every network card has a 48-bit MAC address. A frame says which card it is for and which card sent it, and a switch delivers it: it learns which port each address is behind from the frames it sees, and sends each frame only where it needs to go.',
  facts: [['Layer', 'Data Link (Layer 2)'], ['Address', '48-bit MAC'], ['Header', '14 bytes, plus a 4-byte FCS'], ['Frame size', '64 to 1,518 bytes'], ['Speeds', '10 Mb/s to 800 Gb/s'], ['Defined In', 'IEEE 802.3']],
};

export const outro = {
  title: 'Switched', subtitle: 'Learned, flooded, forwarded',
  text: 'The switch learned where the laptop and the NAS were from the frames they sent, flooded only the broadcast, and sent every other frame out of just the port it needed. MAC addresses carried each frame across one link; at the router the packet moved into a new frame. Press REPLAY to watch it again.',
  facts: [['Learned', '2 addresses, 2 ports'], ['Flooded', 'Only the broadcast'], ['Frame', '14-byte header, 4-byte FCS'], ['Forgets after', '5 minutes unused']],
};

export const steps = [
  {
    id: 'who-has', title: 'Who Has the NAS?', subtitle: 'A broadcast asks for a MAC address',
    text: 'The laptop wants to reach the NAS at 192.168.1.20. On a local network, frames are delivered by MAC address, and the laptop doesn’t know the NAS’s yet. So it sends an ARP request to ff:ff:ff:ff:ff:ff, the broadcast address, into port 1 of the switch.',
    facts: [['Looking for', '192.168.1.20'], ['Sent to', 'ff:ff:ff:ff:ff:ff (all)'], ['Into', 'Switch port 1']],
  },
  {
    id: 'learn', title: 'Learn, Then Flood', subtitle: 'The switch notes where the laptop is',
    text: 'A switch reads each frame’s source address and notes it in its MAC table: 00:00:5e:00:53:10 is on port 1. A broadcast is for everyone, so it sends a copy out of every other port: to the NAS on port 2 and the router on port 8. Frames for unknown addresses are flooded too.',
    facts: [['Learned', '…:53:10 is on port 1'], ['Copies', 'Out of every other port'], ['Unknown address', 'Flooded the same way']],
  },
  {
    id: 'reply', title: 'Only the NAS Answers', subtitle: 'The reply goes to one port',
    text: 'Every device reads the request, but only the NAS has 192.168.1.20, so only it answers, straight to the laptop’s MAC; the router ignores it. The switch learns that 00:00:5e:00:53:20 is on port 2. It already knows where the laptop is, so the reply leaves by port 1 alone.',
    facts: [['Answer', 'To the laptop only'], ['Learned', '…:53:20 is on port 2'], ['Out of', 'Port 1']],
  },
  {
    id: 'forward', title: 'Port to Port', subtitle: 'Frames go only where they must',
    text: 'The laptop connects to the NAS. Each frame starts with the NAS’s MAC, then its own, then a type: 0x0800, an IPv4 packet. After the packet, the card adds a 4-byte checksum. The switch looks up the destination and sends each frame out of port 2 only. The router never sees them.',
    facts: [['Header', 'To, from, type: 14 bytes'], ['Checksum', '4 bytes, added by the card'], ['Router sees', 'Nothing']],
  },
  {
    id: 'off-network', title: 'Off the Network', subtitle: 'A frame for the router',
    text: 'Next the laptop opens a website at 203.0.113.10. That address isn’t on the local network, so the frame goes to the router: the router’s MAC, known from an earlier ARP, is the destination, while the packet inside still names 203.0.113.10. The switch sends it out of port 8.',
    facts: [['Frame to', 'The router’s MAC'], ['Packet to', '203.0.113.10'], ['Out of', 'Port 8']],
  },
  {
    id: 'rewrap', title: 'A New Frame', subtitle: 'Every hop rewraps the packet',
    text: 'The router takes the packet out of the frame, lowers its TTL and swaps in its public address (NAT). Then it puts the packet in a new frame for its next link: its internet-side MAC as the source, the provider’s router as the destination. MAC addresses only ever cross one link.',
    facts: [['From', 'The router’s internet port'], ['To', 'The provider’s router'], ['Packet to', 'Still 203.0.113.10']],
  },
];
