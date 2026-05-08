// Helpers de validación de entradas. Sin deps externas.

export function isString(v: unknown): v is string {
	return typeof v === 'string' && v.trim().length > 0;
}

export function isUuid(v: unknown): v is string {
	return (
		typeof v === 'string' &&
		/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
	);
}

export function isPositiveNumber(v: unknown): v is number {
	return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

export function isNonNegativeNumber(v: unknown): v is number {
	return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

export function isPlainObject(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null && !Array.isArray(v);
}
