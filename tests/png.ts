// A small PNG of coloured blocks, for tests. It pictures nothing.
import { crc32, deflateSync } from "node:zlib";

export type Colour = [number, number, number];

export function makePng(width: number, height: number, colourAt: (x: number, y: number) => Colour): Uint8Array {
  const rows = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) rows.set(colourAt(x, y), y * (1 + width * 3) + 1 + x * 3);
  }
  const chunk = (name: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(name, "latin1"), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const check = Buffer.alloc(4);
    check.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([length, body, check]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  return new Uint8Array(Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", header), chunk("IDAT", deflateSync(rows)), chunk("IEND", Buffer.alloc(0)),
  ]));
}
