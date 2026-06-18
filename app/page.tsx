"use client";

import { useState } from "react";

const MESES = [
  { value: 1, label: "Enero" }, { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" }, { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" }, { value: 6, label: "Junio" },
  { value: 7, label: "Julio" }, { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" }, { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" }, { value: 12, label: "Diciembre" },
];

interface ItemCliente {
  desc: string;
  cantidad: number;
  importe: number;
  importeARCA: number;
  esRemito?: boolean;
}

interface ClientePreview {
  nombre: string;
  clienteRaw: string;
  sv: string;
  direccion: string;
  item1: string;
  item2: string;
  items: ItemCliente[];
  totalReal: number;
  totalARCA: number;
}

export default function Home() {
  const hoy = new Date();
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [archivo, setArchivo] = useState<File | null>(null);
  const [modoPrueba, setModoPrueba] = useState(true);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [clientes, setClientes] = useState<ClientePreview[]>([]);
  const [expandido, setExpandido] = useState<number | null>(null);

  async function handleProcesar() {
    if (!archivo) { setError("Seleccioná un archivo de reporte"); return; }
    setCargando(true);
    setError("");
    setClientes([]);
    try {
      const fd = new FormData();
      fd.append("file", archivo);
      fd.append("mes", String(mes));
      fd.append("anio", String(anio));
      fd.append("modoPrueba", String(modoPrueba));
      const res = await fetch("/api/procesar-reporte", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error desconocido");
      setClientes(data.clientes);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  async function handleDescargar() {
    if (!archivo || !clientes.length) return;
    setCargando(true);
    try {
      const fd = new FormData();
      fd.append("file", archivo);
      fd.append("mes", String(mes));
      fd.append("anio", String(anio));
      fd.append("modoPrueba", String(modoPrueba));
      const res = await fetch("/api/generar-excel", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Error generando Excel");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `FC_ARCA_${String(mes).padStart(2, "0")}_${anio}${modoPrueba ? "_PRUEBA" : ""}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  const fmt = (n: number) => n.toLocaleString("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 });

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Facturar ARCA <span className="text-xs font-normal text-gray-400">v2.2</span></h1>
          <p className="text-gray-500 text-sm">Generador de Excel para importación masiva en ARCA (ex-AFIP)</p>
        </div>

        {/* Panel de control */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex flex-wrap gap-4 items-end">

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Mes</label>
              <select
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-36"
                value={mes}
                onChange={(e) => { setMes(Number(e.target.value)); setClientes([]); }}
              >
                {MESES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Año</label>
              <input
                type="number"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-24"
                value={anio}
                onChange={(e) => { setAnio(Number(e.target.value)); setClientes([]); }}
              />
            </div>

            <div className="flex-1 min-w-48">
              <label className="block text-xs font-medium text-gray-600 mb-1">Reporte del sistema</label>
              <label className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2 cursor-pointer hover:border-blue-400 transition text-sm text-gray-500">
                <span>📄</span>
                <span className="truncate">{archivo ? archivo.name : "Seleccionar .xlsx"}</span>
                <input type="file" accept=".xlsx,.xls" className="hidden"
                  onChange={(e) => { setArchivo(e.target.files?.[0] ?? null); setClientes([]); }} />
              </label>
            </div>

            <div className="flex items-center gap-2 pb-0.5">
              <input type="checkbox" id="prueba" checked={modoPrueba}
                onChange={(e) => { setModoPrueba(e.target.checked); setClientes([]); }}
                className="w-4 h-4 accent-blue-600" />
              <label htmlFor="prueba" className="text-sm text-gray-600 select-none">
                Modo prueba ($0.01)
              </label>
            </div>

            <button
              onClick={handleProcesar}
              disabled={cargando || !archivo}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold px-5 py-2 rounded-lg transition"
            >
              {cargando && !clientes.length ? "Procesando..." : "Procesar"}
            </button>

            {clientes.length > 0 && (
              <button
                onClick={handleDescargar}
                disabled={cargando}
                className="bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white text-sm font-semibold px-5 py-2 rounded-lg transition"
              >
                Descargar Excel ARCA
              </button>
            )}
          </div>

          {error && <p className="text-red-600 text-sm mt-3 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        </div>

        {/* Tabla de validación */}
        {clientes.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-700">{clientes.length} clientes procesados</h2>
              {modoPrueba && (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">
                  MODO PRUEBA — importes $0.01
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left w-8"></th>
                    <th className="px-4 py-3 text-left">Nombre ARCA</th>
                    <th className="px-4 py-3 text-left">Código SV</th>
                    <th className="px-4 py-3 text-left">Ítem 2</th>
                    <th className="px-4 py-3 text-right">Items</th>
                    <th className="px-4 py-3 text-right">Total Real</th>
                    <th className="px-4 py-3 text-right">Total ARCA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {clientes.map((c, i) => (
                    <>
                      <tr
                        key={i}
                        className="hover:bg-gray-50 cursor-pointer transition"
                        onClick={() => setExpandido(expandido === i ? null : i)}
                      >
                        <td className="px-4 py-3 text-gray-400 text-xs">{expandido === i ? "▼" : "▶"}</td>
                        <td className="px-4 py-3 font-medium text-gray-800">{c.nombre}</td>
                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">{c.sv}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-48">{c.item2}</td>
                        <td className="px-4 py-3 text-right text-gray-500">{c.items.length}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{fmt(c.totalReal)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-blue-600">{fmt(c.totalARCA)}</td>
                      </tr>
                      {expandido === i && (
                        <tr key={`${i}-det`}>
                          <td colSpan={7} className="bg-blue-50 px-8 py-3">
                            <p className="text-xs text-gray-500 mb-2 font-medium">ÍTEMS DE LA FACTURA</p>
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-gray-400">
                                  <th className="text-left pb-1 pr-4">#</th>
                                  <th className="text-left pb-1 pr-4">Descripción</th>
                                  <th className="text-right pb-1 pr-4">Cant.</th>
                                  <th className="text-right pb-1 pr-4">Importe Real</th>
                                  <th className="text-right pb-1">Importe ARCA</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr className="text-gray-600">
                                  <td className="pr-4 py-0.5">1</td>
                                  <td className="pr-4 py-0.5">{c.item1}</td>
                                  <td className="text-right pr-4">1</td>
                                  <td className="text-right pr-4">—</td>
                                  <td className="text-right">$0.00</td>
                                </tr>
                                <tr className="text-gray-600">
                                  <td className="pr-4 py-0.5">2</td>
                                  <td className="pr-4 py-0.5">{c.item2}</td>
                                  <td className="text-right pr-4">1</td>
                                  <td className="text-right pr-4">—</td>
                                  <td className="text-right">$0.00</td>
                                </tr>
                                {c.items.map((item, j) => (
                                  <tr key={j} className="text-gray-700">
                                    <td className="pr-4 py-0.5">{j + 3}</td>
                                    <td className="pr-4 py-0.5">{item.desc}</td>
                                    <td className="text-right pr-4">{item.cantidad}</td>
                                    <td className="text-right pr-4">{item.importe > 0 ? fmt(item.importe) : "—"}</td>
                                    <td className="text-right font-medium text-blue-700">
                                      {item.importeARCA > 0 ? fmt(item.importeARCA) : "—"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-xs text-gray-500 font-medium">TOTAL GENERAL</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-700">
                      {fmt(clientes.reduce((s, c) => s + c.totalReal, 0))}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-blue-600">
                      {fmt(clientes.reduce((s, c) => s + c.totalARCA, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
