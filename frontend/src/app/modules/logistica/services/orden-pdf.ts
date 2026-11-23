import { DOCUMENTO_OC } from '../config/documento-oc';

/**
 * PDF de la ORDEN DE COMPRA con el formato de COLD WORK
 * (encabezado con logo y RUC, datos del proveedor, tabla ITEM / CANTIDAD /
 * UND / DESCRIPCIÓN / P.UNITARIO / V. VENTA, totales con IGV, firmas y notas).
 *
 * jsPDF se carga solo cuando se genera un PDF (no pesa en el resto de la app).
 * El texto queda como texto real: se puede buscar, copiar y se imprime nítido.
 */

export interface DatosOrdenPdf {
  /** "2026-0219"; null = aún no guardada (sale "BORRADOR"). */
  codigo: string | null;
  aprobada: boolean;
  fecha: string; // YYYY-MM-DD
  fechaEntrega: string | null;
  moneda: 'PEN' | 'USD';
  proveedor: { razonSocial: string; ruc: string; direccion: string | null };
  atencion: string | null;
  condicionesPago: string | null;
  solicitadoPor: string | null;
  lugarEntrega: string | null;
  cotizacionRef: string | null;
  items: {
    codigo: string;
    descripcion: string;
    cantidad: number;
    unidad: string;
    precio: number;
  }[];
  empresa?: { razonSocial: string; ruc: string | null };
}

const AZUL: [number, number, number] = [10, 64, 140];
const ROJO: [number, number, number] = [200, 30, 40];
const GRIS: [number, number, number] = [110, 110, 110];

const fechaPe = (iso: string | null) =>
  iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—';
const dinero = (n: number) =>
  n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const centimos = (n: number) => Math.round(n * 100);

export function totalesOrden(items: DatosOrdenPdf['items']) {
  const base = items.reduce((t, i) => t + centimos(i.cantidad * i.precio), 0);
  const igv = Math.round(base * 0.18);
  return { base: base / 100, igv: igv / 100, total: (base + igv) / 100 };
}

/** Logo oficial si existe en public/documentos; si no, null (se dibuja el nombre). */
async function cargarLogo(): Promise<string | null> {
  try {
    const r = await fetch(new URL(DOCUMENTO_OC.logo, document.baseURI).href, {
      cache: 'force-cache',
    });
    if (!r.ok || !(r.headers.get('content-type') ?? '').startsWith('image/')) return null;
    const blob = await r.blob();
    return await new Promise((ok) => {
      const lector = new FileReader();
      lector.onload = () => ok(lector.result as string);
      lector.onerror = () => ok(null);
      lector.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function crearPdfOrden(
  d: DatosOrdenPdf,
): Promise<{ bytes: ArrayBuffer; nombre: string; guardar: () => void }> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;
  const M = 12; // margen
  const empresa = d.empresa ?? { razonSocial: DOCUMENTO_OC.razonSocial, ruc: DOCUMENTO_OC.ruc };
  const simbolo = d.moneda === 'USD' ? '$' : 'S/';

  // ---------- Encabezado ----------
  const logo = await cargarLogo();
  if (logo) {
    // 322×76 px → 58 × 13.7 mm, misma proporción
    doc.addImage(logo, 'PNG', M, 9, 58, 13.7, undefined, 'FAST');
  } else {
    dibujarCopo(doc, M + 6.5, 16.5, 5.2);
    doc
      .setFont('helvetica', 'bold')
      .setFontSize(19)
      .setTextColor(...AZUL)
      .text('COLD WORK', M + 14, 18);
    doc
      .setFont('helvetica', 'bold')
      .setFontSize(6.5)
      .setTextColor(...ROJO)
      .text('REFRIGERACIÓN INDUSTRIAL', M + 14.5, 22.5, { charSpace: 0.6 });
  }
  doc.setFont('helvetica', 'bold').setFontSize(6.3).setTextColor(0, 0, 0);
  doc.text(DOCUMENTO_OC.direccion, M, 29);
  doc.text(`CEL: ${DOCUMENTO_OC.celular}`, M, 32.2);

  const tono: [number, number, number] = d.aprobada ? [0, 0, 0] : GRIS;
  doc.setFontSize(15).setTextColor(...tono);
  doc.text(d.aprobada ? 'APROBADO' : 'BORRADOR', W / 2 + 4, 17, { align: 'center' });

  doc
    .setTextColor(0, 0, 0)
    .setFontSize(9)
    .text(`RUC: ${empresa.ruc ?? DOCUMENTO_OC.ruc}`, W - M, 13, { align: 'right' });
  doc.setFontSize(8).text(empresa.razonSocial.toUpperCase(), W - M, 17, { align: 'right' });
  doc
    .setFontSize(11)
    .text(`ORDEN DE COMPRA ${d.codigo ?? '(por asignar)'}`, W - M, 23, { align: 'right' });

  // ---------- Datos del proveedor ----------
  let y = 40;
  const etiqueta = (t: string, x: number, yy: number) =>
    doc.setFont('helvetica', 'bold').setFontSize(7.2).text(t, x, yy);
  const valor = (t: string, x: number, yy: number, ancho = 75) => {
    doc.setFont('helvetica', 'normal').setFontSize(7.2);
    const lineas = doc.splitTextToSize((t || '').toUpperCase(), ancho) as string[];
    doc.text(lineas.slice(0, 2), x, yy);
  };
  const izq: [string, string][] = [
    ['PROVEEDOR', d.proveedor.razonSocial],
    ['DIRECCIÓN', d.proveedor.direccion ?? ''],
    ['ATENCIÓN', d.atencion ?? ''],
    ['CONDICIONES DE PAGO', d.condicionesPago ?? ''],
    ['SOLICITADO', d.solicitadoPor ?? ''],
    ['LUGAR DE ENTREGA', d.lugarEntrega ?? ''],
  ];
  izq.forEach(([k, v], i) => {
    etiqueta(k, M, y + i * 4.6);
    valor(v, M + 36, y + i * 4.6);
  });
  const der: [string, string][] = [
    ['R.U.C.', d.proveedor.ruc],
    ['FECHA', fechaPe(d.fecha)],
    ['FECHA DE ENTREGA', fechaPe(d.fechaEntrega)],
    ...(d.cotizacionRef ? ([['COTIZACIÓN', d.cotizacionRef]] as [string, string][]) : []),
  ];
  der.forEach(([k, v], i) => {
    etiqueta(k, 128, y + i * 4.6);
    valor(v, 160, y + i * 4.6, 40);
  });

  // ---------- Tabla ----------
  y += 6 * 4.6 + 3;
  const filas = d.items.map((it, i) => [
    String(i + 1),
    it.cantidad.toLocaleString('es-PE', { minimumFractionDigits: 3, maximumFractionDigits: 3 }),
    it.unidad === 'UND' ? 'Und' : it.unidad,
    [it.codigo, it.descripcion].filter(Boolean).join(' - ').toUpperCase(),
    dinero(it.precio),
    dinero(it.cantidad * it.precio),
  ]);
  // Relleno para que la tabla se vea como el formato (con espacio hasta los totales)
  const minimo = 14;
  for (let i = filas.length; i < minimo; i++) filas.push(['', '', '', '', '', '']);

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [['ITEM', 'CANTIDAD', 'UND', 'DESCRIPCIÓN', 'P.UNITARIO', 'V. VENTA']],
    body: filas,
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 7,
      cellPadding: { top: 2.2, bottom: 2.2, left: 1.5, right: 1.5 },
      textColor: 0,
      lineColor: 0,
      lineWidth: 0,
    },
    headStyles: {
      fontStyle: 'bold',
      halign: 'center',
      lineWidth: { top: 0.3, bottom: 0.3, left: 0.3, right: 0.3 },
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 14 },
      1: { halign: 'center', cellWidth: 20 },
      2: { halign: 'center', cellWidth: 14 },
      3: { halign: 'center' },
      4: { halign: 'right', cellWidth: 24 },
      5: { halign: 'right', cellWidth: 24 },
    },
    didDrawCell: (c) => {
      // Solo líneas verticales en el cuerpo, como el formato original
      if (c.section !== 'body') return;
      doc.setDrawColor(0).setLineWidth(0.3);
      doc.line(c.cell.x, c.cell.y, c.cell.x, c.cell.y + c.cell.height);
      if (c.column.index === 5)
        doc.line(
          c.cell.x + c.cell.width,
          c.cell.y,
          c.cell.x + c.cell.width,
          c.cell.y + c.cell.height,
        );
    },
  });
  const tabla = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable;
  y = tabla.finalY;
  doc
    .setDrawColor(0)
    .setLineWidth(0.3)
    .line(M, y, W - M, y);

  // ---------- Totales ----------
  const t = totalesOrden(d.items);
  const xs = W - M - 48;
  const filasTot: [string, number][] = [
    ['VALOR DE VENTA', t.base],
    ['I.G.V   18.00%', t.igv],
    ['TOTAL', t.total],
  ];
  doc.rect(xs, y, 48, 14);
  filasTot.forEach(([k, v], i) => {
    const yy = y + 4 + i * 4.4;
    doc.setFont('helvetica', i === 2 ? 'bold' : 'normal').setFontSize(7.2);
    doc.text(k, xs + 1.5, yy);
    doc.text(simbolo, xs + 27, yy);
    doc.text(dinero(v), W - M - 1.5, yy, { align: 'right' });
  });
  doc
    .setFont('helvetica', 'bold')
    .setFontSize(7.2)
    .text('Moneda', M, y + 10);
  doc
    .setFont('helvetica', 'normal')
    .text(`: ${d.moneda === 'USD' ? 'DÓLARES AMERICANOS' : 'SOLES'}`, M + 18, y + 10);

  // ---------- Firmas ----------
  let yf = Math.max(y + 40, 238);
  if (yf > 262) {
    doc.addPage();
    yf = 40;
  }
  doc.setLineWidth(0.3);
  doc.line(M + 8, yf, M + 70, yf);
  doc.line(W - M - 70, yf, W - M - 8, yf);
  doc
    .setFont('helvetica', 'bold')
    .setFontSize(7)
    .text(DOCUMENTO_OC.gerenteGeneral, M + 39, yf + 3.5, { align: 'center' });
  doc.text(DOCUMENTO_OC.cargoGerente, M + 39, yf + 7, { align: 'center' });
  doc.text(DOCUMENTO_OC.cargoCompras, W - M - 39, yf + 5, { align: 'center' });

  doc
    .setFont('helvetica', 'bold')
    .setFontSize(7)
    .text('Creado por :', M, yf + 15);
  doc.setFont('helvetica', 'normal').text((d.solicitadoPor ?? '').toUpperCase(), M + 16, yf + 15);
  doc.setFont('helvetica', 'bold').text('Aprobado por :', W - M - 62, yf + 15);
  doc
    .setFont('helvetica', 'normal')
    .text(d.aprobada ? DOCUMENTO_OC.aprobadoPor : '— pendiente —', W - M - 43, yf + 15);

  // ---------- Notas ----------
  doc.setLineWidth(0.3).line(M, yf + 18, W - M, yf + 18);
  doc
    .setFont('helvetica', 'bold')
    .setFontSize(9)
    .text('NOTA:', M, yf + 23);
  doc.setLineWidth(0.2).line(M, yf + 23.8, M + 11, yf + 23.8);
  doc.setFont('helvetica', 'normal').setFontSize(7);
  DOCUMENTO_OC.notas.forEach((n, i) => doc.text(`${i + 1}. ${n}`, M, yf + 28 + i * 3.6));

  const nombre = `OC-${d.codigo ?? 'borrador'}-${d.proveedor.razonSocial.replace(/[^\w]+/g, '-').slice(0, 30)}.pdf`;
  doc.setProperties({
    title: `Orden de compra ${d.codigo ?? ''}`,
    subject: d.proveedor.razonSocial,
    creator: 'COLDWORK ERP',
  });
  const bytes = doc.output('arraybuffer');
  return { bytes, nombre, guardar: () => descargar(bytes, nombre) };
}

/** Copo de nieve con líneas (cuando no hay logo). */
function dibujarCopo(doc: import('jspdf').jsPDF, cx: number, cy: number, r: number) {
  doc
    .setDrawColor(...AZUL)
    .setLineWidth(0.9)
    .setLineCap('round');
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3;
    const x = cx + r * Math.cos(a),
      yy = cy + r * Math.sin(a);
    doc.line(cx, cy, x, yy);
    for (const s of [-1, 1]) {
      const b = a + (s * Math.PI) / 5;
      const px = cx + r * 0.62 * Math.cos(a),
        py = cy + r * 0.62 * Math.sin(a);
      doc.line(px, py, px + r * 0.35 * Math.cos(b), py + r * 0.35 * Math.sin(b));
    }
  }
  doc.setLineCap('butt');
}

/** Descarga los bytes como archivo (más fiable que doc.save en todos los navegadores). */
export function descargar(bytes: ArrayBuffer, nombre: string) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
