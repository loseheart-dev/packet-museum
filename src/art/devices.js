import hardware from './hardware.svg?raw';

export const deviceDefs = hardware.replace('</defs>', `
  <g id="switch" stroke="#29332d" stroke-width="1.3" stroke-linejoin="round">
    <path d="M-48-24 3 1 48-21-3-46Z" fill="#879286"/>
    <path d="M3 1l45-22v12L3 13Z" fill="#48594e"/>
    <use href="#tray" transform="matrix(1.13 .55 0 .92 -48 -24)"/>
  </g>
</defs>`);

const rack = ['rack', 'm-39-17 50 25 46-23-50-25Z', 32];
const edgeRouter = ['edge-router', 'm-48-13 55 27.5 42-21-55-27.5Z', 32];
const hardwareKinds = {
  pc: ['pc', 'm-69-11 77 38.5 75-37.5-77-38.5Z', 45],
  laptop: ['laptop', 'm-59-21 75 37.5 43-21.5-75-37.5Z', 34],
  router: ['modem', 'm-40-12 50 25 42-21-50-25Z', 32],
  'edge-router': edgeRouter, 'multicast-router': edgeRouter,
  switch: ['switch', 'm-52-12 55 27.5 51-25.5-55-27.5Z', 31],
  cloud: ['cloud', 'm-56 9 42 23 73-27-44-23Z', 39],
  camera: ['camera', 'm-27-6 31 15.5 30-15-31-15.5Z', 28],
  'tv-box': ['tv-box', 'm-45-16 54 27 38-19-54-27Z', 30],
  server: rack, 'dns-server': rack, 'dhcp-server': rack, 'web-server': rack,
  'ntp-server': rack, 'stun-server': rack, 'sip-server': rack, 'ingest-server': rack,
};

export function deviceArt(kind, scale = 1) {
  const [figure, base, labelY] = hardwareKinds[kind];
  const ground = figure === 'rack' && scale < 1 ? 'm-34-14 43 21.5 40-20-43-21.5Z' : base;
  const sprite = kind === 'cloud' ? `<use href="#cloud" class="cloud-base" x="3" y="5"/><use href="#cloud" class="cloud-face"/>
    <g class="cloud-grid" transform="translate(1 -17)"><circle r="15"/><ellipse rx="6" ry="15"/><path d="M-15 0h30m-26-9h22m-22 18h22"/></g>`
    : `<use href="#${figure}"${scale === 1 ? '' : ` transform="scale(${scale})"`}/>`;
  return { markup: `<path class="ground" d="${ground}"/>${sprite}`, labelY };
}
