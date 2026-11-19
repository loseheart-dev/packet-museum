// Protocol Explorer: index-CNPseYOQ.js, DHCP lesson.
export const overview = {
  title: 'DHCP', subtitle: 'Dynamic Host Configuration Protocol',
  text: 'DHCP hands a device everything it needs to use a network: an IP address, the subnet mask, the router to send traffic through and the DNS servers to ask. Addresses are leased for a set time and renewed while the device stays on the network.',
  facts: [['Layer', 'Application (Layer 7)'], ['Ports', 'UDP 67 (server), 68 (client)'], ['Hands out', 'IP, mask, gateway, DNS'], ['Exchange', 'Discover, Offer, Request, Ack'], ['Lease', 'Renewed at half its time'], ['Defined In', 'RFC 2131, RFC 2132']],
};

export const intro = {
  text: 'The laptop has just connected. It has a MAC address built in, but no IP address, no gateway and no DNS server, so it can’t talk to anything beyond its own network yet. It asks for them with DHCP.',
  facts: [['IP address', 'None (uses 0.0.0.0)'], ['MAC address', '00:00:5e:00:53:10']],
};

export const outro = {
  title: 'On the network', subtitle: 'Leased, and kept up to date',
  text: 'Four messages took the laptop from no address to a working configuration, and halfway through the 24-hour lease it renewed it with a direct request to the router. Press REPLAY to watch it again.',
  facts: [['Messages', '4 to join, 2 per renewal'], ['Address', '192.168.1.10/24'], ['Lease', '24 h, renewed at 12 h'], ['Ports', 'UDP 68 → 67']],
};

export const steps = [
  {
    id: 'discover', title: 'Discover', subtitle: 'Shout to the whole network',
    text: 'Without an address of its own, the laptop sends from 0.0.0.0 to the broadcast address 255.255.255.255, so every device on the local network receives it. Only DHCP servers answer.',
    facts: [['From', '0.0.0.0, UDP port 68'], ['To', '255.255.255.255, port 67'], ['Carries', 'MAC, transaction ID']],
    frames: ['dhcp-1'], closeup: ['client'],
  },
  {
    id: 'offer', title: 'Offer', subtitle: 'The router proposes an address',
    text: 'The router’s DHCP server picks a free address and offers it with the rest of the settings. The laptop can’t use an IP address yet, so the offer goes straight to its MAC address (some clients ask for a broadcast instead).',
    facts: [['Offered', '192.168.1.10/24'], ['Gateway, DNS', '192.168.1.1, 8.8.8.8'], ['Lease', '86,400 s (24 h)']],
    frames: ['dhcp-2'],
  },
  {
    id: 'request', title: 'Request', subtitle: 'Accept, out loud',
    text: 'The laptop asks for the offered address, naming the server it chose. It still broadcasts, so any other DHCP server that made an offer learns it wasn’t picked and can release its address.',
    facts: [['Requests', '192.168.1.10'], ['Chosen server', '192.168.1.1'], ['Sent to', '255.255.255.255']],
    frames: ['dhcp-3'],
  },
  {
    id: 'acknowledge', title: 'Acknowledge', subtitle: 'The address is the laptop’s',
    text: 'The server confirms, and the laptop configures its address, mask, gateway and DNS server. Many systems first check with ARP that no other device is already using the address.',
    facts: [['Address', '192.168.1.10/24'], ['Gateway', '192.168.1.1'], ['DNS server', '8.8.8.8']],
    frames: ['dhcp-4'],
  },
  {
    id: 'renew', title: 'Renew', subtitle: 'Halfway through the lease',
    text: 'Twelve hours later, half the lease has passed. The laptop now has an address, so it asks the router directly to extend the lease, and the router resets it to 24 hours. If the router didn’t answer, it would broadcast at 87.5%.',
    facts: [['When', '50% of lease (T1 = 12 h)'], ['Sent to', 'The router (unicast)'], ['If unanswered', 'Broadcast at 87.5% (T2)']],
    frames: ['dhcp-5', 'dhcp-6'], wide: true,
  },
];

export const packets = [
  ['0.000s', 'Discover', ['0.0.0.0 → 255.255.255.255', 'any DHCP server out there?']],
  ['0.004s', 'Offer', ['offer: 192.168.1.10/24', 'gateway, DNS, lease 24 h']],
  ['0.006s', 'Request', ['I’ll take 192.168.1.10', 'from server 192.168.1.1']],
  ['0.009s', 'ACK', ['192.168.1.10 is yours', 'for 24 hours']],
  ['43200.000s', 'Request', ['renew 192.168.1.10', 'sent straight to 192.168.1.1']],
  ['43200.003s', 'ACK', ['lease renewed', 'another 24 hours']],
];
