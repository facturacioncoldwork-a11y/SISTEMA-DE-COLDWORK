import { DOCUMENTO_OC } from '../../logistica/config/documento-oc';
import type { Cotizacion } from '../models/cotizacion.model';
import type { Cliente } from '../models/servicios.model';
import { hitosConMonto, subtotalSeccion, totalesCotizacion, totalLinea, venceEl } from '../utils/cotizacion';

/**
 * PDF formal de la COTIZACIÓN (mismo orden que el resumen en Excel de COLD WORK):
 * encabezado, datos del cliente, secciones con subtotal, inversión con IGV,
 * tiempo de entrega, forma de pago, notas y cuentas. Los costos internos NUNCA salen.
 */

const AZUL: [number, number, number] = [10, 64, 140];
const GRIS: [number, number, number] = [100, 110, 125];
const FONDO: [number, number, number] = [234, 241, 250];

export interface DatosCotizacionPdf {
  cotizacion: Cotizacion;
  cliente?: Cliente;
  empresa: { razonSocial: string; ruc: string | null };
  datos: { enviarOrdenA: string; cuentas: { banco: string; moneda: string; numero: string; cci: string }[] };
}

const fechaPe = (iso: string) => iso.split('-').reverse().join('/');

async function cargarLogo(): Promise<string | null> {
  try {
    const r = await fetch(new URL(DOCUMENTO_OC.logo, document.baseURI).href, { cache: 'force-cache' });
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

export async function descargarCotizacionPdf(d: DatosCotizacionPdf): Promise<void> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;
  const H = 297;
  const M = 14;
  const q = d.cotizacion;
  const t = totalesCotizacion(q);
  const simbolo = q.moneda === 'USD' ? 'US$' : 'S/';
  const num = (n: number) => n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ── Encabezado ────────────────────────────────────────────────
  const logo = await cargarLogo();
  if (logo) doc.addImage(logo, 'PNG', M, 10, 55, 13, undefined, 'FAST');
  else doc.setFont('helvetica', 'bold').setFontSize(18).setTextColor(...AZUL).text('COLD WORK', M, 19);
  doc.setTextColor(0, 0, 0).setFont('helvetica', 'bold').setFontSize(10).text(d.empresa.razonSocial.toUpperCase(), W - M, 13, { align: 'right' });
  doc.setFont('helvetica', 'normal').setFontSize(8);
  doc.text(`RUC: ${d.empresa.ruc ?? DOCUMENTO_OC.ruc}`, W - M, 17.5, { align: 'right' });
  doc.text(DOCUMENTO_OC.direccion, W - M, 21.5, { align: 'right' });

  doc.setFillColor(...AZUL).rect(M, 27, W - 2 * M, 8, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(255, 255, 255);
  doc.text(`COTIZACIÓN N° ${q.numero}`, W / 2, 32.6, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  // ── Datos del cliente ─────────────────────────────────────────
  const cli = d.cliente;
  autoTable(doc, {
    startY: 38,
    margin: { left: M, right: M },
    theme: 'plain',
    styles: { fontSize: 8.4, cellPadding: 1.2 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 26 }, 1: { cellWidth: 70 }, 2: { fontStyle: 'bold', cellWidth: 32 } },
    body: [
      ['Cliente', `: ${cli?.razonSocial ?? '—'}`, 'Fecha', `: ${fechaPe(q.fecha)}`],
      ['RUC', `: ${cli?.ruc ?? '—'}`, 'Validez de oferta', `: ${q.validezDias} días (hasta ${fechaPe(venceEl(q))})`],
      ['Atención', `: ${q.atencion || '—'}`, 'Enviar orden a', `: ${d.datos.enviarOrdenA}`],
      ['Celular', `: ${q.celular || '—'}`, 'Moneda', `: ${q.moneda === 'USD' ? 'Dólares americanos' : 'Soles'}`],
      ['Proyecto', `: ${q.proyecto}`, '', ''],
      ['Ubicación', `: ${q.ubicacion || '—'}`, '', ''],
    ],
  });
  let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 3;

  // ── Ítems por sección ─────────────────────────────────────────
  const filas: (string | { content: string; colSpan?: number; styles?: object })[][] = [];
  q.secciones.forEach((s, i) => {
    filas.push([
      { content: String(i + 1), styles: { fontStyle: 'bold', fillColor: FONDO } },
      { content: s.titulo.toUpperCase(), colSpan: 5, styles: { fontStyle: 'bold', fillColor: FONDO } },
    ]);
    for (const l of s.lineas) {
      filas.push(['', l.descripcion, l.unidad, String(l.cantidad), num(l.precio), num(totalLinea(l))]);
    }
    filas.push([
      '',
      { content: `Subtotal ${simbolo}`, colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } },
      { content: num(subtotalSeccion(s)), styles: { fontStyle: 'bold' } },
    ]);
  });
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    theme: 'grid',
    head: [['Item', 'Descripción', 'Unidad', 'Cant.', 'P. unitario', 'Total']],
    body: filas,
    styles: { fontSize: 8.2, cellPadding: 1.6, lineColor: [205, 214, 226], lineWidth: 0.2, textColor: [20, 30, 45] },
    headStyles: { fillColor: AZUL, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 11, halign: 'center' }, 2: { cellWidth: 16 }, 3: { cellWidth: 13, halign: 'right' }, 4: { cellWidth: 26, halign: 'right' }, 5: { cellWidth: 28, halign: 'right' } },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;

  // ── Inversión ─────────────────────────────────────────────────
  if (y > H - 75) {
    doc.addPage();
    y = 18;
  }
  autoTable(doc, {
    startY: y,
    margin: { left: W - M - 80, right: M },
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 1.8, lineColor: [205, 214, 226], lineWidth: 0.2 },
    columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right', cellWidth: 32 } },
    body: [
      [`Valor de venta ${simbolo}`, num(t.valorVenta)],
      ['I.G.V. 18 %', num(t.igv)],
      [{ content: `TOTAL ${simbolo}`, styles: { fillColor: AZUL, textColor: [255, 255, 255] } }, { content: num(t.total), styles: { fillColor: AZUL, textColor: [255, 255, 255], fontStyle: 'bold' } }],
    ],
  });
  const finTotales = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  // ── Condiciones (a la izquierda de los totales y debajo) ──────
  doc.setFont('helvetica', 'bold').setFontSize(9).text('INVERSIÓN Y CONDICIONES', M, y + 4);
  doc.setFont('helvetica', 'normal').setFontSize(8.4);
  let yc = y + 9;
  const linea = (texto: string, negrita = false) => {
    const partes = doc.setFont('helvetica', negrita ? 'bold' : 'normal').splitTextToSize(texto, W - 2 * M - 88);
    for (const p of partes) {
      doc.text(p, M, yc);
      yc += 4.2;
    }
  };
  if (q.tiempoEntrega) linea(`Tiempo de entrega: ${q.tiempoEntrega}`);
  if (q.hitos.length) {
    linea('Forma de pago:', true);
    for (const h of hitosConMonto(q.hitos, t.total)) linea(`• ${h.descripcion}: ${h.porcentaje} % (${simbolo} ${num(h.monto)})`);
  }
  if (q.detraccion) linea(`Operación sujeta a detracción del ${q.detraccion} % (SPOT).`);
  y = Math.max(yc, finTotales) + 4;

  if (q.notas.trim()) {
    doc.setFont('helvetica', 'bold').setFontSize(9).text('Notas:', M, y);
    y += 4.5;
    doc.setFont('helvetica', 'normal').setFontSize(8.4);
    for (const n of q.notas.split('\n').filter((x) => x.trim())) {
      for (const p of doc.splitTextToSize(`• ${n.trim()}`, W - 2 * M)) {
        doc.text(p, M, y);
        y += 4.2;
      }
    }
    y += 2;
  }

  // ── Cuentas ───────────────────────────────────────────────────
  if (y > H - 40) {
    doc.addPage();
    y = 18;
  }
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    theme: 'grid',
    head: [['Banco', 'Moneda', 'N.° de cuenta', 'CCI']],
    body: d.datos.cuentas.map((c) => [c.banco, c.moneda, c.numero, c.cci || '—']),
    styles: { fontSize: 8, cellPadding: 1.4, lineColor: [205, 214, 226], lineWidth: 0.2 },
    headStyles: { fillColor: FONDO, textColor: [20, 30, 45], fontStyle: 'bold' },
  });

  // ── Pie ───────────────────────────────────────────────────────
  const paginas = doc.getNumberOfPages();
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p);
    doc.setFontSize(7).setTextColor(...GRIS);
    doc.text(`${q.numero} · ${d.empresa.razonSocial}`, M, H - 8);
    doc.text(`Página ${p} de ${paginas}`, W - M, H - 8, { align: 'right' });
  }

  doc.save(`${q.numero} - ${q.proyecto || 'cotizacion'}.pdf`.replace(/[\\/:*?"<>|]/g, '-'));
}
