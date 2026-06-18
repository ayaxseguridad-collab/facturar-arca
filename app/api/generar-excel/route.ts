import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";

const MESES = ["", "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
  "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];

// Base col para ítem i (0-indexed): 14, 18, 22, ... (4 columnas por ítem)
function itemBase(i: number): number { return 14 + i * 4; }

function nombreDisplay(raw: string): string {
  if (raw.includes(",")) {
    const [ap, nom] = raw.split(",", 2).map((s: string) => s.trim());
    return `${nom} ${ap}`;
  }
  return `${raw} ${raw}`;
}

function extraerSV(codigoAlfa: string): string {
  const m = codigoAlfa.match(/SV-([^/]+)/i);
  return m ? m[1] : codigoAlfa;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const mes = parseInt(formData.get("mes") as string);
    const anio = parseInt(formData.get("anio") as string);
    const modoPrueba = formData.get("modoPrueba") === "true";

    if (!file) return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: "buffer", cellDates: true, sheetRows: 0 });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws["!ref"] || ws["!ref"] === "A1") {
      const cellKeys = Object.keys(ws).filter(k => !k.startsWith("!"));
      if (cellKeys.length > 1) {
        const decoded = cellKeys.map(k => XLSX.utils.decode_cell(k));
        const maxRow = Math.max(...decoded.map(c => c.r));
        const maxCol = Math.max(...decoded.map(c => c.c));
        ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxRow, c: maxCol } });
      }
    }
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: null });

    const mesReal = mes || new Date((rows[0] as any).FECHA).getMonth() + 1;
    const anioReal = anio || new Date((rows[0] as any).FECHA).getFullYear();
    const mesNombre = MESES[mesReal];

    const grupos = new Map<number, any[]>();
    for (const row of rows as any[]) {
      const oid = row.ORDER_ID as number;
      if (!grupos.has(oid)) grupos.set(oid, []);
      grupos.get(oid)!.push(row);
    }

    const wbOut = new ExcelJS.Workbook();
    const wsOut = wbOut.addWorksheet("Hoja1");

    let rowIdx = 1;
    for (const [, filas] of grupos) {
      const primera = filas[0];
      const clienteRaw = String(primera.CLIENTE || "");
      const codigoAlfa = String(primera.CODIGOALFA || "");
      const codigoDisplay = codigoAlfa.split('/')[0];
      const nombre = nombreDisplay(clienteRaw);
      const r = rowIdx++;

      const itemsExtra: { desc: string; cantidad: number; importe: number }[] = [];
      for (const fila of filas) {
        const codigoPro = String(fila.CODIGOPRO || "").trim();
        const desc = String(fila.NOMBRE || "").trim();
        const precio = parseFloat(fila.PRECIOFINA || 0);
        const cantidad = parseFloat(fila.CANTIDAD || 1);
        const uVal = parseFloat(fila.TIP_LETRA || 0);

        if (uVal === 5 && codigoPro === "9999") continue;
        if (uVal === 1 && codigoPro === "9999") {
          if (desc.startsWith("(")) continue; // fila de código-cuenta: saltar
          // Sub-Cuenta u otra fila TIP_LETRA=1 sin "(": incluir como ítem sin precio
          itemsExtra.push({ desc, cantidad: 1, importe: 0 });
          continue;
        }
        if (desc.startsWith("REMITOS")) {
          itemsExtra.push({ desc, cantidad: 1, importe: 0 });
          continue;
        }
        if (precio > 0 || codigoPro !== "9999") {
          itemsExtra.push({ desc, cantidad, importe: precio });
        }
      }

      // Pre-calcular total como valor numérico (ARCA lee el valor cacheado, no la fórmula)
      const importesCalc = itemsExtra.map(item =>
        modoPrueba
          ? (item.importe > 0 ? Math.round(0.01 * item.cantidad * 100) / 100 : 0)
          : aplicarIva(item.importe, item.desc)
      );
      const totalCalc = Math.round(importesCalc.reduce((s, v) => s + v, 0) * 100) / 100;

      wsOut.getCell(r, 1).value = nombre;
      wsOut.getCell(r, 2).value = "CONSUMIDOR FINAL";
      wsOut.getCell(r, 4).value = null;
      wsOut.getCell(r, 5).value = totalCalc;

      wsOut.getCell(r, 6).value = 1.0;
      wsOut.getCell(r, 7).value = 1.0;
      wsOut.getCell(r, 8).value = `SERVICIOS DEL MES "${mesNombre}" DE ${anioReal}`;
      wsOut.getCell(r, 9).value = 0.0;

      wsOut.getCell(r, 10).value = 2.0;
      wsOut.getCell(r, 11).value = 1.0;
      wsOut.getCell(r, 12).value = `(${codigoDisplay}) ${clienteRaw}`;
      wsOut.getCell(r, 13).value = 0.0;

      itemsExtra.forEach((item, i) => {
        const base = itemBase(i);
        const importeARCA = modoPrueba
          ? (item.importe > 0 ? Math.round(0.01 * item.cantidad * 100) / 100 : 0.0)
          : aplicarIva(item.importe, item.desc);
        wsOut.getCell(r, base).value = float(i + 3);
        wsOut.getCell(r, base + 1).value = item.desc ? 1.0 : null;
        wsOut.getCell(r, base + 2).value = item.desc || null;
        wsOut.getCell(r, base + 3).value = importeARCA;
      });
    }

    const outBuffer = await wbOut.xlsx.writeBuffer();
    const suffix = modoPrueba ? "_PRUEBA" : "";
    return new NextResponse(outBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="FC_ARCA_${String(mesReal).padStart(2, "0")}_${anioReal}${suffix}.xlsx"`,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Error generando Excel" }, { status: 500 });
  }
}

function float(n: number): number { return n + 0.0; }

function aplicarIva(importe: number, desc: string): number {
  if (/canon|cobrador/i.test(desc)) return importe;
  return Math.round(importe * 1.21 * 100) / 100;
}
