// src/features/printer/protocols/TsplEncoder.test.ts
import { TsplEncoder } from './TsplEncoder';

describe('TsplEncoder', () => {
  const decode = (bytes: Uint8Array): string => String.fromCharCode(...Array.from(bytes));

  it('initialize() emits SIZE/GAP/CLS sized for 58mm paper', () => {
    const output = decode(new TsplEncoder().initialize('58mm').encode());
    expect(output).toContain('SIZE 50 mm, 30 mm');
    expect(output).toContain('GAP 2 mm, 0 mm');
    expect(output).toContain('CLS');
  });

  it('initialize() emits SIZE sized for 80mm paper', () => {
    const output = decode(new TsplEncoder().initialize('80mm').encode());
    expect(output).toContain('SIZE 72 mm, 30 mm');
  });

  it('text() emits a TEXT command with escaped quotes', () => {
    const output = decode(new TsplEncoder().text(10, 20, 'Máy in "A"').encode());
    expect(output).toContain('TEXT 10,20,"3",0,1,1,"Máy in \\"A\\""');
  });

  it('barcode() emits a BARCODE command', () => {
    const output = decode(new TsplEncoder().barcode(0, 0, '12345').encode());
    expect(output).toContain('BARCODE 0,0,"128",50,1,0,2,2,"12345"');
  });

  it('qrcode() emits a QRCODE command', () => {
    const output = decode(new TsplEncoder().qrcode(0, 0, 'https://ndtcore.local').encode());
    expect(output).toContain('QRCODE 0,0,H,4,A,0,"https://ndtcore.local"');
  });

  it('cut() emits PRINT 1,1 and chains fluently with the other builders', () => {
    const output = decode(
      new TsplEncoder().initialize('58mm').text(0, 0, 'A').cut().encode(),
    );
    expect(output.trim().endsWith('PRINT 1,1')).toBe(true);
  });
});
