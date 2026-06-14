import ExcelJS from "exceljs";

export interface ItemFactura {
  descripcion: string;
  cantidad: number;
  importe: number;
}

export interface ClienteFactura {
  nombre: string;
  tipoContribuyente: string;
  direccion: string;
  codigoSV: string;
  mes: string;
  anio: number;
  items: ItemFactura[]; // máx 7 items extra (ítems 3 a 9)
}

const MESES = [
  "", "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
  "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE",
];

export async function generarExcelArca(
  clientes: ClienteFactura[],
  mes: number,
  anio: number
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Hoja1");

  // 47 columnas (A a AU), 1000 filas pre-reservadas igual que el modelo
  ws.columns = Array.from({ length: 47 }, (_, i) => ({ width: 20 }));

  clientes.forEach((cliente, idx) => {
    const row = idx + 1;
    const mesNombre = MESES[mes];

    // Bloque fijo: nombre, tipo, dirección, total
    ws.getCell(row, 1).value = cliente.nombre;
    ws.getCell(row, 2).value = cliente.tipoContribuyente;
    ws.getCell(row, 4).value = cliente.direccion;
    ws.getCell(row, 5).value = { formula: `Q${row}+U${row}+Y${row}+AC${row}+AG${row}+AK${row}+AO${row}` };

    // Ítem 1: encabezado del mes
    ws.getCell(row, 6).value = 1;
    ws.getCell(row, 7).value = 1;
    ws.getCell(row, 8).value = `SERVICIOS DEL MES "${mesNombre}" DE ${anio}`;
    ws.getCell(row, 9).value = 0;

    // Ítem 2: código SV + nombre
    ws.getCell(row, 10).value = 2;
    ws.getCell(row, 11).value = 1;
    ws.getCell(row, 12).value = `(SV-${cliente.codigoSV}) ${cliente.nombre}`;
    ws.getCell(row, 13).value = 0;

    // Ítems 3-9: columnas de inicio por ítem
    const itemCols = [14, 18, 22, 26, 30, 34, 38]; // col N, R, V, Z, AD, AH, AL
    // importes en: Q(17), U(21), Y(25), AC(29), AG(33), AK(37), AO(41)

    cliente.items.forEach((item, i) => {
      if (i >= 7) return;
      const baseCol = itemCols[i];
      ws.getCell(row, baseCol).value = i + 3;
      ws.getCell(row, baseCol + 1).value = item.importe !== 0 ? item.cantidad : null;
      ws.getCell(row, baseCol + 2).value = item.importe !== 0 ? item.descripcion : null;
      ws.getCell(row, baseCol + 3).value = item.importe;
    });

    // Rellenar ítems vacíos hasta el 9
    for (let i = cliente.items.length; i < 7; i++) {
      const baseCol = itemCols[i];
      ws.getCell(row, baseCol).value = i + 3;
      ws.getCell(row, baseCol + 3).value = 0;
    }
  });

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
