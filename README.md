# notas-venta-750843

Módulo **2 de 3** del Examen 2. Crea notas de venta, genera el PDF, lo
sube a S3 y delega la notificación al módulo de notificaciones.
**Es el módulo instrumentado con CloudWatch (las dos métricas
requeridas + dashboard + alarma viven aquí).**

> Forma parte de la solución del Examen 2 (Diego Romo Mendoza, exp. 750843).

## Endpoints

| Método | Ruta                    | Descripción                              |
|--------|-------------------------|------------------------------------------|
| GET    | `/ping`                 | healthcheck                              |
| POST   | `/sales`                | crear nota de venta + PDF + notificación |
| GET    | `/sales/:id`            | obtener nota con sus items               |
| GET    | `/sales/download/:id`   | descargar el PDF de la nota desde S3     |

`POST /sales` consulta cliente y productos al módulo de catálogos por HTTP
(`CATALOGOS_URL`) y dispara la notificación llamando al módulo de
notificaciones por HTTP (`NOTIFICACIONES_URL`).

## Variables de entorno

Ver `.env.example`.

## Observabilidad (apartado 7-9 del enunciado)

### Métricas (apartado 7)

Todas las requests pasan por el middleware `metricsMiddleware` que
emite a CloudWatch:

| Métrica                  | Unidad        | Para qué sirve                                       |
|--------------------------|---------------|------------------------------------------------------|
| `HttpRequestCount`       | Count         | comportamiento por familia 2xx / 4xx / 5xx           |
| `HttpRequestDurationMs`  | Milliseconds  | duración por request — base para p50/p90/p99         |

Dimensiones de cada métrica:
- `Environment` (`local` o `production`) — discrimina ambientes
- `Route`        (ej. `POST /sales`)     — etiqueta la ruta normalizada
- `StatusFamily` (`2xx` / `3xx` / `4xx` / `5xx`)

Namespace: `Examen2/750843` (configurable con `CW_NAMESPACE`).

Para apagar el envío de métricas en pruebas locales sin AWS:
```bash
CW_ENABLED=false npm start
```

### Dashboard (apartado 9)

`observability/dashboard.json` — JSON que importas tal cual en
CloudWatch Console (icono `</>` en "View/edit source"). Contiene:

1. **Latencia POST /sales (p50, p90, p99)** — apartado 9.i
2. **Comportamiento HTTP POST /sales (2xx vs 4xx vs 5xx)** — apartado 9.ii
3. *(extra)* Errores 5xx por ruta usando `SEARCH()`
4. *(extra)* Comparativa local vs production de la misma métrica

### Alarma (apartado 8)

`observability/alarm.json` — alarma "más de 3 errores 5xx en POST /sales
en 5 minutos en production". El umbral está justificado en el reporte.

### Crear todo de un golpe

```bash
export SNS_TOPIC_ARN="arn:aws:sns:us-east-1:XXXX:tu-topic"
bash observability/create-observability.sh
```

## Cómo correrlo

### Local
```bash
cp .env.example .env
npm install
npm run build
npm start            # http://localhost:8082/ping
```

### Docker
```bash
docker build -t notas-venta-750843 .
docker run --rm -p 8082:8082 --env-file .env notas-venta-750843
```

## CI/CD

Pipeline en `.github/workflows/notas-venta.yml`. Mismas 3 etapas
(`build` → `docker` → `deploy`) que los otros módulos.
