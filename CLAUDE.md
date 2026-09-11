@AGENTS.md

# ⚠️ PROYECTO: Preparar Excel para facturar

Toma el reporte de clientes que sale de **Bykom** y arma el Excel que después se
carga en el facturador. **No emite facturas**: sólo transforma un archivo en
otro.

| Dato | Valor |
|------|-------|
| **Repo GitHub** | `ayaxseguridad-collab/facturar-arca` — ⚠️ **público** |
| **Producción** | https://app-production-df57.up.railway.app |
| **Railway** | servicio `app`, rama `master` |
| **Directorio local** | `~/Escritorio/CLOUDE/facturar-arca` |
| **Acceso** | usuario `ayax`; la clave está en `publicar.sh` y en el acceso directo del Escritorio |

## NO CONFUNDIR CON `factura-arca`

Son dos proyectos y los nombres se parecen demasiado:

| | este | el otro |
|---|---|---|
| carpeta | `facturar-arca` | `factura-arca` |
| qué hace | arma el Excel | emite contra AFIP (WSFEv1/SOAP) |
| producción | app-production-df57 | facturar-arca-production |
| base de datos | ninguna | Convex `glad-weasel-825` |

Este archivo decía antes que el repo era `prepara-excel-facturar` y que producía
en Vercel. **Las dos cosas son falsas.**

## CÓMO SE DEPLOYA

`git push origin master`. Railway está conectado al repo y publica solo; tarda
unos minutos.

**No hay forma de confirmar desde afuera que el deploy entró.** El header dice
`v2.2` fijo desde junio de 2026 y no se actualiza (GAS-233). Si algo sigue
saliendo mal después de un push, puede ser que Railway todavía no haya
terminado: esperar y volver a probar antes de dar el cambio por fallido.

`publicar.sh` **no hace falta** para desplegar: sirvió una sola vez para crear el
proyecto en Railway. Volver a correrlo **pisa la contraseña** con la que tenga
escrita adentro (GAS-232).

`preparar-excel.sh` levanta la app en esta PC, en el puerto 3100.

## LA LÓGICA ESTÁ COPIADA EN TRES ARCHIVOS

El mismo recorrido del reporte de Bykom está duplicado en:

1. `app/api/procesar-reporte/route.ts` — la vista previa en pantalla
2. `app/api/generar-excel/route.ts` — el Excel que se descarga
3. `scripts/convertir_reporte.py` — el script suelto, por fuera de la web

**Tocar uno solo hace que la pantalla y el archivo digan cosas distintas.** Ya
pasó: el bug de septiembre de 2026 (GAS-230) nació de un cambio aplicado a los
tres, y el arreglo hubo que hacerlo también en los tres.

## LA TRAMPA DE `pendingSubCuenta`

Cuando una fila del reporte tiene `TIP_LETRA=1` y `CODIGOPRO=9999`, su
descripción se guarda y **pisa la descripción del ítem siguiente**:

```js
const descFinal = pendingSubCuenta ?? desc;
```

Eso es a propósito para las filas `Sub-Cuenta: …`. Pero si la condición se
afloja para que entren también las filas `(SV-xxxx) APELLIDO, NOMBRE`, se come
el `ABONO MONITOREO` de todos los abonados comunes — que son casi todos. Es
exactamente lo que rompió septiembre.

Antes de tocar esa parte, leer GAS-230 y GAS-231.

## NO USA BASE DE DATOS

La carpeta `convex/` existe pero **ninguna parte de la app la usa** (GAS-234).
No hay backend que desplegar ni datos que migrar: la app recibe un archivo,
lo transforma y devuelve otro, sin guardar nada.

## CÓMO PROBAR UN CAMBIO

Hace falta un reporte de Bykom de verdad; los Excel ya generados no sirven para
probar el generador. Con el reporte:

```
./preparar-excel.sh      # levanta en localhost:3100
```

Cargarlo, y mirar que la columna **P** diga `ABONO MONITOREO` y no el nombre del
cliente repetido de la **L**.
