#!/usr/bin/env bash
# =============================================================================
# Script para crear el dashboard y la alarma de CloudWatch.
# =============================================================================
# Uso:
#   export SNS_TOPIC_ARN="arn:aws:sns:us-east-1:XXXX:tu-topic"
#   bash observability/create-observability.sh
#
# Requiere AWS CLI v2 y credenciales activas (laboratorio AWS Academy o
# las del workflow).
# =============================================================================
set -e

REGION="${AWS_REGION:-us-east-1}"
DASHBOARD_NAME="Examen2-NotasVenta-750843"
ALARM_NAME="examen2-notas-venta-5xx-spike"

if [ -z "$SNS_TOPIC_ARN" ]; then
    echo "ERROR: Necesitas exportar SNS_TOPIC_ARN antes de correr este script."
    echo "       export SNS_TOPIC_ARN='arn:aws:sns:us-east-1:XXXXXXXXXXXX:tu-topic'"
    exit 1
fi

cd "$(dirname "$0")"

# -----------------------------------------------------------------------------
# 1) Dashboard
# -----------------------------------------------------------------------------
echo "[obs] Creando/actualizando dashboard $DASHBOARD_NAME en región $REGION..."

# Quitamos los campos de comentario (que CloudWatch rechaza) y enviamos el JSON.
TMP_DASH="$(mktemp)"
# El sed elimina cualquier "_comment*": "...", o ,"_comment*": "..."
node -e "
const fs = require('fs');
const j = JSON.parse(fs.readFileSync('dashboard.json', 'utf8'));
function clean(o) {
  if (Array.isArray(o)) return o.map(clean);
  if (o && typeof o === 'object') {
    const out = {};
    for (const k of Object.keys(o)) {
      if (!k.startsWith('_comment')) out[k] = clean(o[k]);
    }
    return out;
  }
  return o;
}
fs.writeFileSync('$TMP_DASH', JSON.stringify(clean(j)));
"

aws cloudwatch put-dashboard \
    --region "$REGION" \
    --dashboard-name "$DASHBOARD_NAME" \
    --dashboard-body "file://$TMP_DASH"

rm -f "$TMP_DASH"
echo "[obs] Dashboard listo: https://$REGION.console.aws.amazon.com/cloudwatch/home?region=$REGION#dashboards:name=$DASHBOARD_NAME"

# -----------------------------------------------------------------------------
# 2) Alarma
# -----------------------------------------------------------------------------
echo "[obs] Creando/actualizando alarma $ALARM_NAME..."

aws cloudwatch put-metric-alarm \
    --region "$REGION" \
    --alarm-name "$ALARM_NAME" \
    --alarm-description "Spike de 5xx en POST /sales (production) — más de 3 en 5 min." \
    --namespace "Examen2/750843" \
    --metric-name "HttpRequestCount" \
    --statistic "Sum" \
    --dimensions \
        Name=Environment,Value=production \
        Name=Route,Value="POST /sales" \
        Name=StatusFamily,Value=5xx \
    --period 60 \
    --evaluation-periods 5 \
    --datapoints-to-alarm 1 \
    --threshold 3 \
    --comparison-operator GreaterThanThreshold \
    --treat-missing-data notBreaching \
    --alarm-actions "$SNS_TOPIC_ARN"

echo "[obs] Alarma lista. La verás en:"
echo "      https://$REGION.console.aws.amazon.com/cloudwatch/home?region=$REGION#alarmsV2:alarm/$ALARM_NAME"
