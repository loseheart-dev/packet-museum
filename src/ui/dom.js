export const $ = id => document.getElementById(id);
export const mobile = matchMedia('(max-width: 760px)');
export const motion = matchMedia('(prefers-reduced-motion: reduce)');
export const svgNS = 'http://www.w3.org/2000/svg';
export const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
export const facts = (items = []) => items.map(([name, value]) => `<div><dt>${escape(name)}</dt><dd>${escape(value)}</dd></div>`).join('');
