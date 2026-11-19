export const text = value => new TextEncoder().encode(value);
export const decode = bytes => new TextDecoder().decode(bytes);
export const hex = (value, width = 2) => value.toString(16).padStart(width, '0');
export const ipText = bytes => bytes.join('.');
export const macText = bytes => Array.from(bytes, value => hex(value)).join(':');
export const hexText = bytes => Array.from(bytes, value => hex(value)).join(' ');
export const empty = new Uint8Array();

export function requireBytes(ok, message) {
  if (!ok) throw new RangeError(message);
}

export function uint(value, length) {
  requireBytes(Number.isInteger(value) && value >= 0 && value < 256 ** length, `无效的 ${length} 字节整数: ${value}`);
  return Uint8Array.from({ length }, (_, i) => Math.floor(value / 256 ** (length - 1 - i)) & 255);
}

export function concat(...chunks) {
  requireBytes(chunks.every(chunk => chunk instanceof Uint8Array), '载荷必须是 Uint8Array');
  const bytes = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

export function ipv4Address(value) {
  const parts = value.split('.');
  requireBytes(parts.length === 4 && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) < 256), `无效的 IPv4 地址: ${value}`);
  return Uint8Array.from(parts, Number);
}

export function macAddress(value) {
  requireBytes(/^(?:[\da-f]{2}:){5}[\da-f]{2}$/i.test(value), `无效的 MAC 地址: ${value}`);
  return Uint8Array.from(value.split(':'), part => parseInt(part, 16));
}

export function checksum(bytes) {
  let sum = 0;
  for (let i = 0; i < bytes.length; i += 2) {
    sum += bytes[i] * 256 + (bytes[i + 1] ?? 0);
    sum = (sum & 65535) + (sum >>> 16);
  }
  return ~sum & 65535;
}

export function transportChecksum(src, dst, protocol, bytes) {
  return checksum(concat(ipv4Address(src), ipv4Address(dst), uint(protocol, 2), uint(bytes.length, 2), bytes));
}

export class Reader {
  constructor(bytes, offset, label, color) {
    this.bytes = bytes;
    this.offset = offset;
    this.label = label;
    this.color = color;
    this.fields = [];
    this.pos = 0;
  }

  read(length) {
    requireBytes(Number.isInteger(length) && length >= 0 && this.pos + length <= this.bytes.length,
      `${this.label}: 偏移 ${this.offset + this.pos} 缺少 ${length} 字节`);
    const start = this.pos;
    this.pos += length;
    return this.bytes.subarray(start, this.pos);
  }

  slice(label, length, format = hexText) {
    const offset = this.offset + this.pos;
    const bytes = this.read(length);
    if (length) this.fields.push({ label, offset, length, value: format(bytes) });
    return bytes;
  }

  number(label, length, format = String) {
    let value = 0;
    this.slice(label, length, bytes => {
      value = bytes.reduce((n, b) => n * 256 + b, 0);
      return format(value);
    });
    return value;
  }

  rest() { return this.bytes.length - this.pos; }

  end() { requireBytes(this.rest() === 0, `${this.label}: 有 ${this.rest()} 字节未解析`); }

  layer() { return { label: this.label, color: this.color, offset: this.offset, length: this.pos, fields: this.fields }; }
}

export const numberHex = (value, width = 4) => `0x${hex(value, width)}`;
export const size = value => `${value} B`;
