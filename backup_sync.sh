#!/bin/bash
# Aquatech CRM - Backup Automático cada 6 horas
# Guarda dump local + sincroniza al remoto (stackcp)

BACKUP_DIR="/root/backups"
LOCAL_DB="aquatech"
LOCAL_USER="root"
REMOTE_HOST="mysql.gb.stackcp.com"
REMOTE_PORT="39643"
REMOTE_USER="aquatech-prueba-3230353c94"
REMOTE_PASS="hrf2vvbkq0"
REMOTE_DB="aquatech-prueba-3230353c94"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/aquatech_$TIMESTAMP.sql"
LOG_FILE="$BACKUP_DIR/backup.log"

mkdir -p "$BACKUP_DIR"

echo "=== BACKUP $(date) ===" >> "$LOG_FILE"

# 1. Dump MySQL local
echo "[1/3] Dumpeando MySQL local..." >> "$LOG_FILE"
mysqldump -u $LOCAL_USER $LOCAL_DB \
  --single-transaction \
  --routines \
  --triggers \
  --complete-insert \
  2>> "$LOG_FILE" > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "   OK: $(ls -lh "$BACKUP_FILE" | awk '{print $5}')" >> "$LOG_FILE"
else
    echo "   ERROR: Fallo el dump local" >> "$LOG_FILE"
    exit 1
fi

# 2. Importar al remoto (stackcp) - sobrescribe la BD vieja con datos frescos
echo "[2/3] Sincronizando a stackcp..." >> "$LOG_FILE"
mysql -h $REMOTE_HOST -P $REMOTE_PORT -u $REMOTE_USER -p"$REMOTE_PASS" $REMOTE_DB < "$BACKUP_FILE" 2>> "$LOG_FILE"

if [ $? -eq 0 ]; then
    echo "   OK: stackcp actualizado" >> "$LOG_FILE"
else
    echo "   WARN: No se pudo sync a stackcp (continuando)" >> "$LOG_FILE"
fi

# 3. Limpiar backups viejos (más de 7 días)
echo "[3/3] Limpiando backups viejos..." >> "$LOG_FILE"
find "$BACKUP_DIR" -name "aquatech_*.sql" -mtime +7 -delete 2>> "$LOG_FILE"
echo "   OK: $(ls "$BACKUP_DIR"/*.sql 2>/dev/null | wc -l) backups guardados" >> "$LOG_FILE"

echo "=== FIN $(date) ===" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"
