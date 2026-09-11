#!/usr/bin/env bash
# Levanta "Preparar Excel para facturar" en esta PC y lo abre en el navegador.
#
# La app toma el reporte de clientes y arma el Excel para importar en el
# portal de ARCA. No usa base de datos ni claves: trabaja con el archivo que
# le cargues y descarga el Excel resultante.

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PUERTO=3100

cd "$DIR" || { echo "No encontré $DIR"; read -r -p "Enter para cerrar..."; exit 1; }

if [ ! -d node_modules ]; then
  echo "Primera vez: instalando lo que necesita (puede tardar unos minutos)..."
  npm install || { echo "Falló la instalación."; read -r -p "Enter para cerrar..."; exit 1; }
fi

echo "Compilando..."
if ! npm run build; then
  echo
  echo "El build falló — no se puede levantar la app."
  read -r -p "Enter para cerrar..."
  exit 1
fi

echo
echo "  Preparar Excel para facturar → http://localhost:$PUERTO"
echo
echo "  Dejá esta ventana abierta mientras la uses."
echo "  Para cerrarla: Ctrl+C, o cerrá esta ventana."
echo

( for _ in $(seq 1 60); do
    if curl -s -o /dev/null "http://localhost:$PUERTO"; then
      xdg-open "http://localhost:$PUERTO" >/dev/null 2>&1
      break
    fi
    sleep 0.5
  done ) &

npm start -- --port "$PUERTO"

echo
read -r -p "Enter para cerrar..."
