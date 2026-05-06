import { Request, Response } from 'express';
import { putItem, getItem } from '../services/dbOperations';
import { v4 as uuid } from 'uuid';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { db } from '../services/dynamo';
import { generateSalePDF } from './pdf-generator';
import { fetchClient, fetchProduct, notifySaleCreated } from '../services/upstream';

import {
	S3Client,
	GetObjectCommand,
	CopyObjectCommand,
	HeadObjectCommand,
	PutObjectCommand,
} from '@aws-sdk/client-s3';

const SALES_TABLE = process.env.SALES_TABLE || 'sales';
const ITEMS_TABLE = process.env.ITEMS_TABLE || 'sale_items';

const s3 = new S3Client({
	region: process.env.AWS_REGION || 'us-east-1',
	credentials: process.env.AWS_SESSION_TOKEN
		? {
				accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
				secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
				sessionToken: process.env.AWS_SESSION_TOKEN,
		  }
		: undefined,
});

export const createSale = async (req: Request, res: Response) => {
	try {
		const body = req.body;

		if (!body.clientId || !body.items) {
			return res.status(400).json({ error: 'Missing fields' });
		}

		// Cliente: se obtiene del módulo de catálogos por HTTP.
		const client: any = await fetchClient(body.clientId);
		if (!client) return res.status(404).json({ error: 'Client not found' });

		const saleId = uuid();
		const folio = `F-${Date.now()}`;
		let total = 0;
		const items = [];
		const itemsForPdf = [];

		for (const item of body.items) {
			// Producto: también se obtiene del módulo de catálogos.
			const product: any = await fetchProduct(item.productId);
			if (!product) {
				return res
					.status(404)
					.json({ error: `Product ${item.productId} not found` });
			}

			const importe = item.cantidad * item.precioUnitario;
			total += importe;

			const saleItem = {
				id: uuid(),
				saleId,
				productId: item.productId,
				cantidad: item.cantidad,
				precioUnitario: item.precioUnitario,
				importe,
			};

			await putItem(ITEMS_TABLE, saleItem);
			items.push(saleItem);

			itemsForPdf.push({
				nombre: product.nombre,
				cantidad: item.cantidad,
				precioUnitario: item.precioUnitario,
				importe,
			});
		}

		const sale = {
			id: saleId,
			folio,
			clientId: body.clientId,
			billingAddressId: body.billingAddressId,
			shippingAddressId: body.shippingAddressId,
			total,
			createdAt: new Date().toISOString(),
		};

		await putItem(SALES_TABLE, sale);

		// Genera el PDF y lo sube a S3 con los 3 metadatos requeridos
		// (idéntico al examen 1).
		const pdfBuffer = await generateSalePDF(client, folio, itemsForPdf);
		const bucket = `${process.env.EXPEDIENTE}-esi3898k-examen2`;
		const key = `${client.rfc}/${folio}.pdf`;

		await s3.send(
			new PutObjectCommand({
				Bucket: bucket,
				Key: key,
				Body: pdfBuffer,
				ContentType: 'application/pdf',
				Metadata: {
					'hora-envio': new Date().toISOString(),
					'nota-descargada': 'false',
					'veces-enviado': '1',
				},
			}),
		);

		// Notificación: la delegamos al módulo de notificaciones por HTTP.
		const baseUrl = process.env.BASE_URL || 'http://localhost:8082';
		const downloadUrl = `${baseUrl}/sales/download/${saleId}`;

		try {
			await notifySaleCreated({
				email: client.email,
				folio,
				nombreComercial: client.nombreComercial,
				downloadUrl,
			});
		} catch (notifyErr) {
			// La venta ya quedó persistida; si falla la notificación lo logueamos
			// pero no tumbamos la respuesta del cliente.
			console.error('[ventas] notify failed:', (notifyErr as Error).message);
		}

		return res.status(201).json({ sale, items });
	} catch (error) {
		console.error('Error creating sale:', error);
		return res.status(500).json({
			error: 'Error creating sale',
			detail: (error as Error).message,
		});
	}
};

export const getSale = async (req: Request, res: Response) => {
	try {
		const id = req.params.id;

		const sale = await getItem(SALES_TABLE, { id });

		if (!sale) {
			return res.status(404).json({ message: 'Sale not found' });
		}

		const result = await db.send(
			new ScanCommand({
				TableName: ITEMS_TABLE,
				FilterExpression: 'saleId = :s',
				ExpressionAttributeValues: { ':s': id },
			}),
		);

		return res.json({
			...sale,
			items: result.Items,
		});
	} catch (error) {
		return res.status(500).json({ error: 'Error fetching sale' });
	}
};

export const downloadSale = async (req: Request, res: Response) => {
	try {
		const saleId = req.params.id;

		const sale = await getItem(SALES_TABLE, { id: saleId });
		if (!sale) return res.status(404).json({ message: 'Sale not found' });

		// Para el path en S3 necesitamos el RFC, que vive en el módulo de
		// catálogos (no en notas-venta).
		const client: any = await fetchClient(sale.clientId);
		if (!client) return res.status(404).json({ message: 'Client not found' });

		const bucket = `${process.env.EXPEDIENTE}-esi3898k-examen2`;
		const key = `${client.rfc}/${sale.folio}.pdf`;

		const head = await s3.send(
			new HeadObjectCommand({ Bucket: bucket, Key: key }),
		);

		// Actualiza nota-descargada=true preservando los demás metadatos.
		await s3.send(
			new CopyObjectCommand({
				Bucket: bucket,
				CopySource: `${bucket}/${key}`,
				Key: key,
				MetadataDirective: 'REPLACE',
				ContentType: head.ContentType || 'application/pdf',
				Metadata: {
					...(head.Metadata || {}),
					'nota-descargada': 'true',
				},
			}),
		);

		const file = await s3.send(
			new GetObjectCommand({ Bucket: bucket, Key: key }),
		);

		if (!file.Body) {
			return res.status(404).json({ message: 'PDF not found in S3' });
		}

		res.setHeader('Content-Type', 'application/pdf');
		res.setHeader(
			'Content-Disposition',
			`attachment; filename="${sale.folio}.pdf"`,
		);

		(file.Body as NodeJS.ReadableStream).pipe(res);
	} catch (error) {
		console.error(error);
		return res.status(500).json({ error: 'Error downloading sale' });
	}
};
