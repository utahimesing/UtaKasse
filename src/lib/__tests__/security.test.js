import { describe, it, expect } from 'vitest';
import { escapeCsvCell, buildTransactionsCsvText } from '../reporting.js';
import { buildXlsxArrayBuffer } from '../exportXlsx.js';

const evil = '=HYPERLINK("http://evil.example","點我")';

describe('CSV 公式注入（CSV injection）', () => {
  it('開頭是 = + - @ tab 換行的文字前面加 \'', () => {
    expect(escapeCsvCell('=1+1')).toBe("'=1+1");
    expect(escapeCsvCell('+886')).toBe("'+886");
    expect(escapeCsvCell('-cmd')).toBe("'-cmd");
    expect(escapeCsvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(escapeCsvCell('\t=1')).toBe("'\t=1");
  });
  it('有逗號／引號時加 \' 後再用引號包起來', () => {
    expect(escapeCsvCell(evil)).toBe(`"'=HYPERLINK(""http://evil.example"",""點我"")"`);
  });
  it('數字（含負數）、一般文字、空值不受影響', () => {
    expect(escapeCsvCell(-160)).toBe('-160');
    expect(escapeCsvCell(0)).toBe('0');
    expect(escapeCsvCell('海報A')).toBe('海報A');
    expect(escapeCsvCell('a=b')).toBe('a=b');
    expect(escapeCsvCell(null)).toBe('');
  });
  it('流水帳 CSV：買家備註是公式也只會變成文字', () => {
    const tx = { id: 'x', receiptNo: 'R1', date: 'D', createdAt: 1, type: 'sale', subtotal: 100,
      payments: [{ methodName: '現金', isCash: true }], items: [{ productId: 'p', productName: '海報', qty: 1, unitPrice: 100 }], note: evil };
    const row = buildTransactionsCsvText({ dateKey: 'D', transactions: [tx] }).split('\n')[1];
    expect(row.endsWith(`"'=HYPERLINK(""http://evil.example"",""點我"")"`)).toBe(true);
  });
});

describe('Excel 匯出不會產生公式', () => {
  it('備註是 =HYPERLINK(...) 時存成純文字，沒有公式', async () => {
    const XLSX = await import('xlsx');
    const tx = { id: 'x', receiptNo: 'R1', date: 'D', createdAt: 1, type: 'sale', subtotal: 100,
      payments: [{ methodName: '現金', isCash: true }], items: [{ productId: 'p', productName: evil, qty: 1, unitPrice: 100 }], note: evil };
    const buf = await buildXlsxArrayBuffer({ dateKey: 'D', transactions: [tx], products: [], categories: [] });
    const wb = XLSX.read(buf, { type: 'array', cellFormula: true });
    for (const name of wb.SheetNames) {
      for (const [addr, cell] of Object.entries(wb.Sheets[name])) {
        if (addr.startsWith('!')) continue;
        expect(cell.f, `${name}!${addr}`).toBeUndefined();
      }
    }
  });
});
