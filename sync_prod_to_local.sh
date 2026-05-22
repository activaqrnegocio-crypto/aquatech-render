#!/bin/bash
# ─── SCRIPT: Sincronizar DB de Producción → Local ───────────────
# Uso: bash sync_prod_to_local.sh
# 
# 1. Hace dump de la DB de producción en el VPS
# 2. Descarga el dump
# 3. Lo importa a la DB local (stackcp)
#
# ⚠️ SOLO LECTURA en producción. No se modifica nada allá.
# ⚠️ Sobrescribe la DB local con los datos de producción.

set -e

VPS_IP="178.238.238.158"
VPS_USER="root"
SSH_KEY="vps_deploy_key"
LOCAL_DUMP="prod_dump.sql"

echo "📦 Conectando a VPS ($VPS_IP)..."

# 1. Hacer dump en el VPS (solo lectura, no afecta nada)
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$VPS_USER@$VPS_IP" \
  "mysqldump --single-transaction --quick -u aquatech -p'Aquatech2026!Secure' aquatech > /tmp/prod_dump.sql && echo '✅ Dump creado en VPS'" || {
  echo "❌ Error: No se pudo conectar al VPS. Verifica la IP y la clave SSH."
  exit 1
}

echo "📥 Descargando dump..."

# 2. Descargar el dump a la PC local
scp -i "$SSH_KEY" -o StrictHostKeyChecking=no "$VPS_USER@$VPS_IP:/tmp/prod_dump.sql" "./$LOCAL_DUMP"

# 3. Limpiar el dump del VPS
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$VPS_USER@$VPS_IP" "rm /tmp/prod_dump.sql"

echo "💾 Importando a base de datos LOCAL (stackcp)..."

# 4. Importar a la base de datos local (stackcp)
mysql -u aquatech-prueba-3230353c94 -p'hrf2vvbkq0' -h mysql.gb.stackcp.com -P 39643 aquatech-prueba-3230353c94 < "$LOCAL_DUMP"

echo "✅ ¡Listo! Base de datos local actualizada con datos de producción."
echo "   Archivo dump guardado en: $LOCAL_DUMP (por si necesitas restaurar)"
