// Store PNG files without recompression, using the standard ZIP directory format.
export function zipFiles(files: { name: string; bytes: Uint8Array }[]): Uint8Array {
  const chunks: Uint8Array[] = [], directory: Uint8Array[] = [];
  let offset = 0, directorySize = 0;
  const crc = (bytes: Uint8Array) => {
    let c = 0xffffffff;
    for (const byte of bytes) { c ^= byte; for (let i = 0; i < 8; i++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0); }
    return (c ^ 0xffffffff) >>> 0;
  };
  for (const file of files) {
    const name = new TextEncoder().encode(file.name), size = file.bytes.length, checksum = crc(file.bytes);
    const header = new Uint8Array(30 + name.length), h = new DataView(header.buffer);
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x800, true);
    h.setUint16(12, 33, true); h.setUint32(14, checksum, true); h.setUint32(18, size, true); h.setUint32(22, size, true);
    h.setUint16(26, name.length, true); header.set(name, 30); chunks.push(header, file.bytes);
    const central = new Uint8Array(46 + name.length), d = new DataView(central.buffer);
    d.setUint32(0, 0x02014b50, true); d.setUint16(4, 20, true); d.setUint16(6, 20, true); d.setUint16(8, 0x800, true);
    d.setUint16(14, 33, true); d.setUint32(16, checksum, true); d.setUint32(20, size, true); d.setUint32(24, size, true);
    d.setUint16(28, name.length, true); d.setUint32(42, offset, true); central.set(name, 46);
    directory.push(central); directorySize += central.length; offset += header.length + size;
  }
  const end = new Uint8Array(22), e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
  e.setUint32(12, directorySize, true); e.setUint32(16, offset, true);
  const result = new Uint8Array(offset + directorySize + end.length); let index = 0;
  for (const chunk of [...chunks, ...directory, end]) { result.set(chunk, index); index += chunk.length; }
  return result;
}
