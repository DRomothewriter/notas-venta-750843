import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import routes from './app/routes';
import { metricsMiddleware } from './app/observability/middleware';
import { cloudwatchConfig } from './app/observability/cloudwatch';

const PORT = parseInt(process.env.PORT || '8082', 10);
const APP_ENV = process.env.APP_ENV || 'local';

export const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware de observabilidad: se registra ANTES del router para que el
// `res.on('finish')` corra al final de cada request, sin importar la ruta.
// La ruta normalizada se obtiene de `req.route` cuando hubo match.
app.use(metricsMiddleware);

app.get('/ping', (_req, res) => {
	res.json({ ping: 'pong', service: 'notas-venta', env: APP_ENV });
});

app.use(routes);

app.listen(PORT, () => {
	console.log(
		`[notas-venta] running on http://localhost:${PORT} (env=${APP_ENV})`,
	);
	console.log(
		`[notas-venta] cloudwatch: namespace=${cloudwatchConfig.namespace}, enabled=${cloudwatchConfig.enabled}`,
	);
});
