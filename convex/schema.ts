import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  clientes: defineTable({
    nombre: v.string(),
    tipoContribuyente: v.string(),
    direccion: v.string(),
    codigoSV: v.string(),
    cobrador: v.optional(v.boolean()),
    activo: v.boolean(),
  }).index("by_codigo", ["codigoSV"]),

  servicios: defineTable({
    clienteId: v.id("clientes"),
    descripcion: v.string(),
    importe: v.number(),
    tipo: v.string(), // "abono_monitoreo" | "canon_policial" | "cobrador" | "remito" | "equipo"
    orden: v.number(),
  }).index("by_cliente", ["clienteId"]),

  facturas: defineTable({
    mes: v.number(),
    anio: v.number(),
    estado: v.string(), // "pendiente" | "generada" | "subida"
    archivoUrl: v.optional(v.string()),
    cantidadClientes: v.number(),
    creadaEn: v.number(),
  }),
});
