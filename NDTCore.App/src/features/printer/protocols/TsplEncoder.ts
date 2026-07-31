import type { PaperSize } from '../types/printer.types';

export class TsplEncoder {
  private commands: string[] = [];

  initialize(paperSize: PaperSize): this {
    const widthMm = paperSize === '58mm' ? 50 : 72;
    this.commands.push(`SIZE ${widthMm} mm, 30 mm`);
    this.commands.push('GAP 2 mm, 0 mm');
    this.commands.push('CLS');
    return this;
  }

  text(x: number, y: number, content: string): this {
    const escaped = content.replace(/"/g, '\\"');
    this.commands.push(`TEXT ${x},${y},"3",0,1,1,"${escaped}"`);
    return this;
  }

  barcode(x: number, y: number, content: string): this {
    this.commands.push(`BARCODE ${x},${y},"128",50,1,0,2,2,"${content}"`);
    return this;
  }

  qrcode(x: number, y: number, content: string): this {
    this.commands.push(`QRCODE ${x},${y},H,4,A,0,"${content}"`);
    return this;
  }

  cut(): this {
    this.commands.push('PRINT 1,1');
    return this;
  }

  encode(): Uint8Array {
    const payload = `${this.commands.join('\r\n')}\r\n`;
    const bytes = new Uint8Array(payload.length);
    for (let i = 0; i < payload.length; i += 1) {
      // eslint-disable-next-line no-bitwise -- intentional single-byte masking to produce raw TSPL output bytes
      bytes[i] = payload.charCodeAt(i) & 0xff;
    }
    return bytes;
  }
}
