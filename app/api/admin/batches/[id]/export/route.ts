import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { stringify } from 'csv-stringify/sync';
import PDFDocument from 'pdfkit';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const batchId = parseInt(params.id);
    const batch = await db.getBatch(batchId);

    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    const codes = await db.getRedemptionCodesBatch(batchId);
    const exportFormat = request.nextUrl.searchParams.get('format') || 'csv';

    if (exportFormat === 'pdf') {
      return await exportPDF(batch, codes);
    } else {
      return exportCSV(batch, codes);
    }
  } catch (error) {
    console.error('Error exporting batch:', error);
    return NextResponse.json({ error: 'Failed to export batch' }, { status: 500 });
  }
}

function exportCSV(batch: any, codes: any[]) {
  const csvData = [
    ['Code', 'Plan', 'Status', 'Created At'],
    ...codes.map((c) => [c.code, batch.product_name, c.status, c.created_at]),
  ];

  const csv = stringify(csvData);
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="batch-${batch.id}-codes.csv"`,
    },
  });
}

function exportPDF(batch: any, codes: any[]): Promise<NextResponse> {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 20,
  });

  doc.fontSize(16).font('Helvetica-Bold').text(`Batch ${batch.id} - ${batch.product_name}`, {
    align: 'center',
  });

  doc.fontSize(10).text(`Created: ${new Date(batch.created_at).toLocaleDateString()}`, {
    align: 'center',
  });

  doc.moveDown();
  doc.fontSize(12).text(`Total Codes: ${codes.length}`, {
    align: 'center',
  });

  doc.moveDown(2);

  const qrsPerRow = 3;
  let qrIndex = 0;

  while (qrIndex < codes.length) {
    for (let row = 0; row < 7 && qrIndex < codes.length; row++) {
      for (let col = 0; col < qrsPerRow && qrIndex < codes.length; col++) {
        const code = codes[qrIndex];
        const x = 40 + col * 150;
        const y = doc.y + row * 80;

        if (code.qr_code_data_uri) {
          doc.image(code.qr_code_data_uri, x, y, { width: 80, height: 80 });
        }

        doc.fontSize(8).text(code.code, x, y + 85, { width: 80, align: 'center' });

        qrIndex++;
      }
    }

    if (qrIndex < codes.length) {
      doc.addPage();
    }
  }

  const chunks: Uint8Array[] = [];
  return new Promise((resolve) => {
    doc.on('data', (chunk: Uint8Array) => chunks.push(chunk));
    doc.on('end', () => {
      const buffer = Buffer.concat(chunks);
      resolve(
        new NextResponse(buffer, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="batch-${batch.id}-qrcodes.pdf"`,
          },
        })
      );
    });
    doc.end();
  });
}
