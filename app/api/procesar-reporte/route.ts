import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

const MESES = ["", "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
  "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];

function nombreDisplay(raw: string): string {
  if (raw.includes(",")) {
    const [ap, nom] = raw.split(",", 2).map(s => s.trim());
    return `${nom} ${ap}`;
  }
  return `${raw} ${raw}`;
}

function aplicarIva(importe: number, desc: string): number {
  if (/canon|cobrador/i.test(desc)) return importe;
  return Math.round(importe * 1.21 * 100) / 100;
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
    // Forzar rango completo si xlsx no lo detecta correctamente
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

    if (!rows.length) return NextResponse.json({ error: "Archivo vacío" }, { status: 400 });

    // Detectar mes/año del reporte si no se pasan
    const mesReal = mes || new Date((rows[0] as any).FECHA).getMonth() + 1;
    const anioReal = anio || new Date((rows[0] as any).FECHA).getFullYear();
    const mesNombre = MESES[mesReal];

    // Agrupar por ORDER_ID
    const grupos = new Map<number, Record<string, unknown>[]>();
    for (const row of rows) {
      const oid = row.ORDER_ID as number;
      if (!grupos.has(oid)) grupos.set(oid, []);
      grupos.get(oid)!.push(row);
    }

    const clientes = [];

    for (const [, filas] of grupos) {
      const primera = filas[0] as any;
      const clienteRaw = String(primera.CLIENTE || "");
      const codigoAlfa = String(primera.CODIGOALFA || "");
      const codigoDisplay = codigoAlfa.split('/')[0];
      const nombre = nombreDisplay(clienteRaw);

      const itemsExtra = [];
      let pendingSubCuenta: string | null = null;
      for (const fila of filas as any[]) {
        const codigoPro = String(fila.CODIGOPRO || "").trim();
        const desc = String(fila.NOMBRE || "").trim();
        const precio = parseFloat(fila.PRECIOFINA || 0);
        const cantidad = parseFloat(fila.CANTIDAD || 1);
        const uVal = parseFloat(fila.TIP_LETRA || 0);

        if (uVal === 5 && codigoPro === "9999") continue;
        if (uVal === 1 && codigoPro === "9999") {
          if (desc.startsWith("(")) continue;
          pendingSubCuenta = desc;
          continue;
        }
        if (desc.startsWith("REMITOS")) {
          pendingSubCuenta = null;
          itemsExtra.push({ desc, cantidad: 1, importe: 0, esRemito: true });
          continue;
        }
        if (precio > 0 || (codigoPro !== "9999")) {
          const descFinal = pendingSubCuenta ?? desc;
          pendingSubCuenta = null;
          itemsExtra.push({ desc: descFinal, cantidad, importe: precio });
        }
      }

      // Construir filas de visualización
      const itemsConImporte = itemsExtra.map(item => ({
        ...item,
        importeARCA: modoPrueba
          ? (item.importe > 0 ? Math.round(0.01 * item.cantidad * 100) / 100 : 0)
          : aplicarIva(item.importe, item.desc),
      }));

      const totalReal = itemsExtra.reduce((s, i) => s + i.importe, 0);
      const totalARCA = itemsConImporte.reduce((s, i) => s + i.importeARCA, 0);

      clientes.push({
        nombre,
        clienteRaw,
        sv: codigoDisplay,
        direccion: "",
        mesNombre,
        anio: anioReal,
        item1: `SERVICIOS DEL MES "${mesNombre}" DE ${anioReal}`,
        item2: `(${codigoDisplay}) ${clienteRaw}`,
        items: itemsConImporte,
        totalReal,
        totalARCA: Math.round(totalARCA * 100) / 100,
      });
    }

    return NextResponse.json({ clientes, mes: mesReal, anio: anioReal });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Error procesando el archivo" }, { status: 500 });
  }
}
