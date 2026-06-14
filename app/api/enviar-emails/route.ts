import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

const MESES = ["", "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

async function buscarEmail(codigoSV: string): Promise<string | null> {
  try {
    const url = `${process.env.CONVEX_ABONADOS_URL}/abonado?codigoSV=${codigoSV}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data.email ?? null;
  } catch {
    return null;
  }
}

function fmt(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 });
}

function buildHtml(nombre: string, mes: number, anio: number, items: any[], totalReal: number) {
  const filas = items.map((it: any) => `
    <tr>
      <td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;">${it.desc}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;text-align:right;">${it.importe > 0 ? fmt(it.importe) : "—"}</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="es">
<body style="font-family:Arial,sans-serif;color:#333;max-width:560px;margin:0 auto;padding:20px;">
  <div style="background:#1e40af;color:white;padding:20px 24px;border-radius:8px 8px 0 0;">
    <h2 style="margin:0;font-size:18px;">Factura ${MESES[mes].charAt(0).toUpperCase() + MESES[mes].slice(1)} ${anio}</h2>
  </div>
  <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
    <p style="margin:0 0 16px;">Estimado/a <strong>${nombre}</strong>,</p>
    <p style="margin:0 0 16px;">Le enviamos el detalle de su factura correspondiente al mes de <strong>${MESES[mes]} ${anio}</strong>:</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px;">
      <thead>
        <tr style="background:#f9fafb;">
          <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e5e7eb;">Descripción</th>
          <th style="padding:8px 12px;text-align:right;border-bottom:2px solid #e5e7eb;">Importe</th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
      <tfoot>
        <tr style="background:#f9fafb;font-weight:bold;">
          <td style="padding:10px 12px;">Total</td>
          <td style="padding:10px 12px;text-align:right;color:#1e40af;">${fmt(totalReal)}</td>
        </tr>
      </tfoot>
    </table>
    <p style="margin:0;color:#6b7280;font-size:13px;">Ante cualquier consulta no dude en comunicarse con nosotros.</p>
  </div>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  try {
    const { clientes, mes, anio } = await req.json();

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_FROM,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const resultados: { sv: string; nombre: string; email: string | null; ok: boolean; error?: string }[] = [];

    for (const cliente of clientes) {
      const email = await buscarEmail(cliente.sv);
      if (!email) {
        resultados.push({ sv: cliente.sv, nombre: cliente.nombre, email: null, ok: false, error: "Sin email" });
        continue;
      }
      try {
        await transporter.sendMail({
          from: `Facturación <${process.env.EMAIL_FROM}>`,
          to: email,
          subject: `Factura ${MESES[mes]} ${anio} — ${cliente.nombre}`,
          html: buildHtml(cliente.nombre, mes, anio, cliente.items, cliente.totalReal),
        });
        resultados.push({ sv: cliente.sv, nombre: cliente.nombre, email, ok: true });
      } catch (e: any) {
        resultados.push({ sv: cliente.sv, nombre: cliente.nombre, email, ok: false, error: e.message });
      }
    }

    const enviados = resultados.filter((r) => r.ok).length;
    const sinEmail = resultados.filter((r) => !r.email).length;
    const errores = resultados.filter((r) => r.email && !r.ok).length;

    return NextResponse.json({ resultados, enviados, sinEmail, errores });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
