/**
 * Cliente HTTP mínimo para hablar con los otros 2 módulos.
 *
 * Usamos `fetch` nativo (Node 20) para no agregar otra dependencia.
 *
 * Las URLs se inyectan por env (Factor IV - Backing services): los otros
 * módulos son recursos adjuntos intercambiables. Apuntar a localhost en
 * dev o al DNS de EC2 en producción solo cambia una variable.
 */

const CATALOGOS_URL = process.env.CATALOGOS_URL || 'http://localhost:8081';
const NOTIFICACIONES_URL =
	process.env.NOTIFICACIONES_URL || 'http://localhost:8083';

// ---------------------------------------------------------------------------
// Catálogos
// ---------------------------------------------------------------------------

export async function fetchClient(clientId: string) {
	const r = await fetch(`${CATALOGOS_URL}/clientes/${clientId}`);
	if (r.status === 404) return null;
	if (!r.ok) {
		throw new Error(
			`catalogos /clientes/${clientId} responded ${r.status}`,
		);
	}
	return r.json();
}

export async function fetchProduct(productId: string) {
	const r = await fetch(`${CATALOGOS_URL}/productos/${productId}`);
	if (r.status === 404) return null;
	if (!r.ok) {
		throw new Error(
			`catalogos /productos/${productId} responded ${r.status}`,
		);
	}
	return r.json();
}

// ---------------------------------------------------------------------------
// Notificaciones
// ---------------------------------------------------------------------------

export async function notifySaleCreated(payload: {
	email: string;
	folio: string;
	nombreComercial: string;
	downloadUrl: string;
}) {
	const r = await fetch(`${NOTIFICACIONES_URL}/notify/sale`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	});
	if (!r.ok) {
		const text = await r.text();
		throw new Error(`notificaciones /notify/sale responded ${r.status}: ${text}`);
	}
	return r.json();
}
