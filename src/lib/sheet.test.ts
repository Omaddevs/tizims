import { describe, expect, it } from "vitest";
import { deflateRawSync } from "node:zlib";
import { detectColumns, parseCsv, parseXlsx } from "./sheet";

/** Testlar uchun minimal .xlsx (ZIP) yasash — haqiqiy Excel kabi deflate bilan siqilgan */
function makeXlsx(files: Record<string, string>): Uint8Array {
  const enc = new TextEncoder();
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameB = Buffer.from(enc.encode(name));
    const data = deflateRawSync(Buffer.from(enc.encode(content)));
    const raw = enc.encode(content);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameB.length, 26);
    locals.push(local, nameB, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameB.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameB);
    offset += 30 + nameB.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locals, cd, end]));
}

describe("CSV o'qish", () => {
  it("';' ajratuvchi, BOM, qo'shtirnoq ichidagi ';' va bo'sh qatorlar", () => {
    const rows = parseCsv('﻿"F.I.Sh.";Guruh;Telefon\r\n"Aliyev; Vali";IT-21;901234567\r\n\r\n"Qo""shtirnoq Ism";IT-22;\r\n');
    expect(rows).toEqual([
      ["F.I.Sh.", "Guruh", "Telefon"],
      ["Aliyev; Vali", "IT-21", "901234567"],
      ['Qo"shtirnoq Ism', "IT-22", ""],
    ]);
  });

  it("',' ajratuvchini ham taniydi", () => {
    expect(parseCsv("Ism,Guruh\nA B,IT-21")).toEqual([
      ["Ism", "Guruh"],
      ["A B", "IT-21"],
    ]);
  });
});

describe("Excel (.xlsx) o'qish", () => {
  it("umumiy satrlar, raqamlar, bo'sh katak va inline matn", async () => {
    const xlsx = makeXlsx({
      "[Content_Types].xml": "<Types/>",
      "xl/sharedStrings.xml": '<sst><si><t>F.I.Sh.</t></si><si><t>Guruh</t></si><si><r><t>Aliyev </t></r><r><t>Vali &amp; Co</t></r></si><si><t>IT-21</t></si></sst>',
      "xl/worksheets/sheet1.xml":
        '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="D1" t="inlineStr"><is><t>Telefon</t></is></c></row>' +
        '<row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" t="s"><v>3</v></c><c r="D2"><v>998901234567</v></c></row><row r="3"/></sheetData></worksheet>',
    });
    const rows = await parseXlsx(xlsx);
    expect(rows).toEqual([
      ["F.I.Sh.", "Guruh", "", "Telefon"],
      ["Aliyev Vali & Co", "IT-21", "", "998901234567"],
    ]);
  });

  it("buzilgan faylda tushunarli xato", async () => {
    await expect(parseXlsx(new Uint8Array([1, 2, 3, 4]))).rejects.toThrow(/xlsx/);
  });
});

describe("ustunlarni aniqlash", () => {
  it("o'zbekcha sarlavhalar va turli yozilishlar", () => {
    expect(detectColumns([["№", "Talaba F.I.Sh", "Guruhi", "Ta'lim shakli", "Telefon raqami", "Ota-onasi"]]).map).toEqual({ name: 1, group: 2, funding: 3, phone: 4, parent: 5 });
  });

  it("sarlavha bo'lmasa — standart tartib", () => {
    const d = detectColumns([["Aliyev Vali", "IT-21", "Grant"]]);
    expect(d.header).toBe(false);
    expect(d.map.name).toBe(0);
  });
});
