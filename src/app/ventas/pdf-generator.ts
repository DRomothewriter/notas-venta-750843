import PDFDocument from 'pdfkit';

interface Client {
	razonSocial: string;
	nombreComercial: string;
	rfc: string;
	email: string;
	telefono: string;
}

interface ItemForPdf {
	nombre: string;
	cantidad: number;
	precioUnitario: number;
	importe: number;
}

export const generateSalePDF = (
	client: Client,
	folio: string,
	items: ItemForPdf[],
): Promise<Buffer> => {
	return new Promise((resolve, reject) => {
		const doc = new PDFDocument({ margin: 50 });
		const buffers: Buffer[] = [];

		doc.on('data', (chunk) => buffers.push(chunk));
		doc.on('end', () => resolve(Buffer.concat(buffers)));
		doc.on('error', reject);

		// Título
		doc.fontSize(20).font('Helvetica-Bold').text('NOTA DE VENTA', { align: 'center' });
		doc.moveDown(0.5);
		doc.fontSize(12).font('Helvetica').text(`Folio: ${folio}`, { align: 'right' });
		doc.moveDown();

		// Información del cliente
		doc.fontSize(12).font('Helvetica-Bold').text('INFORMACIÓN DEL CLIENTE');
		doc.moveTo(50, doc.y).lineTo(540, doc.y).stroke();
		doc.moveDown(0.3);
		doc.fontSize(10).font('Helvetica');
		doc.text(`Razón Social:      ${client.razonSocial}`);
		doc.text(`Nombre Comercial:  ${client.nombreComercial}`);
		doc.text(`RFC:               ${client.rfc}`);
		doc.text(`Correo:            ${client.email}`);
		doc.text(`Teléfono:          ${client.telefono}`);
		doc.moveDown();

		// Tabla de contenido
		doc.fontSize(12).font('Helvetica-Bold').text('CONTENIDO DE LA NOTA');
		doc.moveTo(50, doc.y).lineTo(540, doc.y).stroke();
		doc.moveDown(0.3);

		const headerY = doc.y;
		doc.fontSize(9).font('Helvetica-Bold');
		doc.text('Cantidad', 50, headerY, { width: 60 });
		doc.text('Producto', 115, headerY, { width: 230 });
		doc.text('Precio Unit.', 350, headerY, { width: 90, align: 'right' });
		doc.text('Importe', 445, headerY, { width: 90, align: 'right' });

		doc.moveTo(50, headerY + 14).lineTo(540, headerY + 14).stroke();
		doc.font('Helvetica');

		let rowY = headerY + 20;
		for (const item of items) {
			doc.fontSize(9);
			doc.text(item.cantidad.toString(), 50, rowY, { width: 60 });
			doc.text(item.nombre, 115, rowY, { width: 230 });
			doc.text(`$${item.precioUnitario.toFixed(2)}`, 350, rowY, {
				width: 90,
				align: 'right',
			});
			doc.text(`$${item.importe.toFixed(2)}`, 445, rowY, { width: 90, align: 'right' });
			rowY += 20;
		}

		doc.moveTo(50, rowY).lineTo(540, rowY).stroke();
		rowY += 10;

		const total = items.reduce((sum, i) => sum + i.importe, 0);
		doc.fontSize(11).font('Helvetica-Bold');
		doc.text(`TOTAL:`, 350, rowY, { width: 90, align: 'right' });
		doc.text(`$${total.toFixed(2)}`, 445, rowY, { width: 90, align: 'right' });

		doc.end();
	});
};
