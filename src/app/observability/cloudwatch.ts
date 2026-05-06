import {
	CloudWatchClient,
	PutMetricDataCommand,
	StandardUnit,
} from '@aws-sdk/client-cloudwatch';

/**
 * Cliente de CloudWatch — comparte el patrón de credenciales con el resto de
 * los servicios AWS del módulo (Factor III - Config).
 */
const cw = new CloudWatchClient({
	region: process.env.AWS_REGION || 'us-east-1',
	credentials: process.env.AWS_SESSION_TOKEN
		? {
				accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
				secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
				sessionToken: process.env.AWS_SESSION_TOKEN,
		  }
		: undefined,
});

const NAMESPACE = process.env.CW_NAMESPACE || 'Examen2/750843';
const APP_ENV = process.env.APP_ENV || 'local';
// CW_ENABLED=false permite apagar el envío en pruebas locales sin AWS.
const CW_ENABLED = (process.env.CW_ENABLED || 'true').toLowerCase() === 'true';

/**
 * Publica una métrica a CloudWatch con la dimensión `Environment` ya
 * inyectada para que el dashboard pueda discernir local vs production
 * (requisito 7.iii del enunciado).
 *
 * Nunca lanza excepción al caller: si falla el envío de métricas no debe
 * tumbar el endpoint que las generó.
 */
export async function putMetric(params: {
	name: string;
	value: number;
	unit: StandardUnit;
	dimensions?: Record<string, string>;
}) {
	if (!CW_ENABLED) return;

	const dims = {
		Environment: APP_ENV,
		...(params.dimensions || {}),
	};

	try {
		await cw.send(
			new PutMetricDataCommand({
				Namespace: NAMESPACE,
				MetricData: [
					{
						MetricName: params.name,
						Value: params.value,
						Unit: params.unit,
						Timestamp: new Date(),
						Dimensions: Object.entries(dims).map(([Name, Value]) => ({
							Name,
							Value,
						})),
					},
				],
			}),
		);
	} catch (err) {
		// No queremos que un fallo de métricas afecte el request del usuario.
		console.error('[cloudwatch] putMetric failed:', (err as Error).message);
	}
}

export const cloudwatchConfig = {
	namespace: NAMESPACE,
	environment: APP_ENV,
	enabled: CW_ENABLED,
};
