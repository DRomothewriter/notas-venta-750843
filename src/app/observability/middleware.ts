import { Request, Response, NextFunction } from 'express';
import { putMetric } from './cloudwatch';

/**
 * Middleware de observabilidad — emite a CloudWatch las 2 métricas que
 * pide el enunciado (apartado 7):
 *
 *   1) HttpRequestCount  (Count) — cuenta requests etiquetadas por familia
 *      de status: 2xx / 4xx / 5xx. Sirve para visualizar comportamiento
 *      bueno/malo del servicio.
 *
 *   2) HttpRequestDurationMs (Milliseconds) — duración de cada request.
 *      Como cada PutMetricData lleva el valor crudo, CloudWatch puede
 *      calcular p50/p90/p99 a partir del histograma de samples.
 *
 * Ambas métricas llevan las dimensiones:
 *   - Environment  (local | production)   — inyectada en putMetric
 *   - Route        (ruta normalizada, ej. "POST /sales")
 *   - StatusFamily (2xx | 3xx | 4xx | 5xx)
 *
 * El middleware se monta después del router para poder acceder a
 * `req.route` y obtener la ruta normalizada (sin parámetros como :id).
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
	const start = process.hrtime.bigint();

	res.on('finish', () => {
		const elapsedNs = process.hrtime.bigint() - start;
		const elapsedMs = Number(elapsedNs) / 1_000_000;

		const status = res.statusCode;
		const family = `${Math.floor(status / 100)}xx`;

		// Ruta normalizada con placeholders (ej. "/sales/:id"). Cuando hay
		// match dentro de un sub-router, `req.route.path` solo tiene la parte
		// relativa al router (ej. "/" para POST /sales), por eso le anteponemos
		// `req.baseUrl` para reconstruir la ruta completa.
		const matched = req.route && req.route.path;
		let route: string;
		if (matched) {
			route =
				req.baseUrl + (matched === '/' ? '' : matched) || matched;
		} else {
			// No hubo match (ej. 404). Usamos el path crudo para no perder señal.
			route = req.originalUrl.split('?')[0] || req.path;
		}

		const routeLabel = `${req.method} ${route}`;

		// Disparamos sin await para no bloquear la respuesta.
		putMetric({
			name: 'HttpRequestCount',
			value: 1,
			unit: 'Count' as any,
			dimensions: { Route: routeLabel, StatusFamily: family },
		});

		putMetric({
			name: 'HttpRequestDurationMs',
			value: elapsedMs,
			unit: 'Milliseconds' as any,
			dimensions: { Route: routeLabel, StatusFamily: family },
		});
	});

	next();
}
