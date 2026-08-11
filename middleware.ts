import { NextRequest, NextResponse } from "next/server";

/**
 * Contraseña de acceso a la app publicada.
 *
 * Solo se aplica si APP_PASS está configurada como variable de entorno; en
 * local (sin variable) la app abre directo.
 */
export function middleware(req: NextRequest) {
  const usuario = process.env.APP_USER || "ayax";
  const clave = process.env.APP_PASS;

  if (!clave) return NextResponse.next();

  const header = req.headers.get("authorization") || "";

  if (header.startsWith("Basic ")) {
    try {
      const [u, p] = atob(header.slice(6)).split(":");
      if (u === usuario && p === clave) return NextResponse.next();
    } catch {
      // credenciales mal formadas: cae al 401
    }
  }

  return new NextResponse("Acceso restringido", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Preparar Excel"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
