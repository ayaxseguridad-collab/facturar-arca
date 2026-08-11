#!/usr/bin/env bash
# Publica "Preparar Excel para facturar" en internet (Railway) y deja el link.
#
# Crea el proyecto, lo conecta al repo de GitHub (cada push publica solo),
# le pone contraseña y genera la dirección. Si ya estaba publicado, no
# duplica nada: solo muestra el link.

API="https://backboard.railway.com/graphql/v2"
WORKSPACE="3f569176-0214-4d1f-b723-7cce29fda80c"
REPO="ayaxseguridad-collab/facturar-arca"
RAMA="master"
NOMBRE="preparar-excel"
APP_USER="ayax"
APP_PASS="ayax-excel-2026"
ESTADO="$HOME/.config/preparar_excel_railway.env"
ESCRITORIO="$HOME/Escritorio"

if [ ! -f "$HOME/.config/railway_token.env" ]; then
  echo "Falta ~/.config/railway_token.env con el token de Railway."
  read -r -p "Enter para cerrar..."; exit 1
fi
source "$HOME/.config/railway_token.env"

gql() {
  curl -s --max-time 90 "$API" \
    -H "Authorization: Bearer $RAILWAY_API_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"query\":\"$1\"}"
}

fallar() { echo; echo "✗ $1"; echo "$2" | head -c 500; echo; read -r -p "Enter para cerrar..."; exit 1; }

[ -f "$ESTADO" ] && source "$ESTADO"

# ── 1. Proyecto ──────────────────────────────────────────────────────────
if [ -z "$PROY_ID" ]; then
  echo "Creando el proyecto en Railway..."
  r=$(gql "mutation { projectCreate(input: {name: \\\"$NOMBRE\\\", workspaceId: \\\"$WORKSPACE\\\", defaultEnvironmentName: \\\"production\\\"}) { id environments { edges { node { id name } } } } }")
  PROY_ID=$(python3 -c "
import sys,json
d=json.load(sys.stdin)
p=(d.get('data') or {}).get('projectCreate')
print(p['id'] if p else '')" <<<"$r")
  ENT_ID=$(python3 -c "
import sys,json
d=json.load(sys.stdin)
p=(d.get('data') or {}).get('projectCreate') or {}
e=[n['node'] for n in p.get('environments',{}).get('edges',[])]
print((e[0]['id'] if e else ''))" <<<"$r")
  [ -z "$PROY_ID" ] && fallar "No se pudo crear el proyecto." "$r"
  echo "  ✓ proyecto creado"
  umask 077
  { echo "PROY_ID=$PROY_ID"; echo "ENT_ID=$ENT_ID"; } > "$ESTADO"
else
  echo "El proyecto ya existía, sigo con lo que falte."
fi

# ── 2. Servicio conectado al repo ────────────────────────────────────────
if [ -z "$SERV_ID" ]; then
  echo "Conectando el repo $REPO (rama $RAMA)..."
  r=$(gql "mutation { serviceCreate(input: {projectId: \\\"$PROY_ID\\\", environmentId: \\\"$ENT_ID\\\", name: \\\"app\\\", branch: \\\"$RAMA\\\", source: {repo: \\\"$REPO\\\"}}) { id } }")
  SERV_ID=$(python3 -c "
import sys,json
d=json.load(sys.stdin)
s=(d.get('data') or {}).get('serviceCreate')
print(s['id'] if s else '')" <<<"$r")
  [ -z "$SERV_ID" ] && fallar "No se pudo crear el servicio." "$r"
  echo "  ✓ repo conectado (cada push va a publicar solo)"
  echo "SERV_ID=$SERV_ID" >> "$ESTADO"
fi

# ── 3. Contraseña ────────────────────────────────────────────────────────
echo "Poniendo la contraseña de acceso..."
for par in "APP_USER=$APP_USER" "APP_PASS=$APP_PASS"; do
  nom="${par%%=*}"; val="${par#*=}"
  r=$(gql "mutation { variableUpsert(input: {projectId: \\\"$PROY_ID\\\", environmentId: \\\"$ENT_ID\\\", serviceId: \\\"$SERV_ID\\\", name: \\\"$nom\\\", value: \\\"$val\\\"}) }")
  grep -q '"errors"' <<<"$r" && fallar "No se pudo cargar $nom." "$r"
done
echo "  ✓ listo"

# ── 4. Dirección pública ─────────────────────────────────────────────────
if [ -z "$DOMINIO" ]; then
  echo "Generando la dirección..."
  r=$(gql "mutation { serviceDomainCreate(input: {environmentId: \\\"$ENT_ID\\\", serviceId: \\\"$SERV_ID\\\"}) { domain } }")
  DOMINIO=$(python3 -c "
import sys,json
d=json.load(sys.stdin)
s=(d.get('data') or {}).get('serviceDomainCreate')
print(s['domain'] if s else '')" <<<"$r")
  [ -z "$DOMINIO" ] && fallar "No se pudo generar la dirección." "$r"
  echo "DOMINIO=$DOMINIO" >> "$ESTADO"
fi
echo "  ✓ https://$DOMINIO"

# ── 5. Esperar a que quede arriba ────────────────────────────────────────
echo
echo "Esperando a que termine de publicarse (suele tardar 2 a 4 minutos)..."
ok=""
for i in $(seq 1 40); do
  sleep 15
  codigo=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 "https://$DOMINIO/")
  echo "  [$((i*15))s] responde $codigo"
  if [ "$codigo" = "401" ] || [ "$codigo" = "200" ]; then ok="si"; break; fi
done

# ── 6. Dejar el acceso a mano ────────────────────────────────────────────
cat > "$ESCRITORIO/Preparar Excel Web.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Preparar Excel Web
Comment=Abre la app de preparar Excel para facturar, ya autenticada
Exec=xdg-open "https://$APP_USER:$APP_PASS@$DOMINIO/"
Icon=x-office-spreadsheet
Terminal=false
Categories=Office;
EOF
chmod +x "$ESCRITORIO/Preparar Excel Web.desktop"
gio set "$ESCRITORIO/Preparar Excel Web.desktop" metadata::trusted true 2>/dev/null

cat > "$ESCRITORIO/Link Preparar Excel.txt" <<EOF
PREPARAR EXCEL PARA FACTURAR - acceso web

Direccion: https://$DOMINIO

Usuario:     $APP_USER
Contrasena:  $APP_PASS

Entra desde cualquier lugar (celular, otra PC).
Desde esta PC, con el icono "Preparar Excel Web" entra solo.
EOF

echo
if [ -n "$ok" ]; then
  echo "✓ Publicada: https://$DOMINIO"
else
  echo "⚠ Tarda más de lo normal. La dirección es https://$DOMINIO — probala en unos minutos."
fi
echo "  Usuario: $APP_USER   Contraseña: $APP_PASS"
echo "  Quedó el icono \"Preparar Excel Web\" en el Escritorio (entra sin escribir nada)."
echo
read -r -p "Enter para cerrar..."
