import type { CellDef } from 'jspdf-autotable';
import { DOCUMENTO_OC } from '../../logistica/config/documento-oc';
import type { Cotizacion } from '../models/cotizacion.model';
import type { Cliente } from '../models/servicios.model';
import { subtotalSeccion, totalesCotizacion, totalLinea } from '../utils/cotizacion';

/**
 * PDF de la COTIZACIÓN con el formato de COLD WORK (igual al Excel de la empresa):
 * marco negro, logo a la izquierda y datos de la empresa a la derecha, título centrado,
 * datos del cliente en dos columnas, tabla con encabezado celeste, cada sección con su
 * número (1.0, 2.0…), su título en celeste y su "SUB TOTAL", bloque de INVERSIÓN con IGV,
 * condiciones y notas a la izquierda y las cuentas bancarias a la derecha.
 * Los costos internos NUNCA salen.
 */

const CELESTE: [number, number, number] = [0, 176, 240];
const NEGRO: [number, number, number] = [0, 0, 0];
const ROJO: [number, number, number] = [230, 0, 0];

export interface CuentaPdf {
  banco: string;
  moneda: string;
  numero: string;
  cci: string;
}

export interface DatosCotizacionPdf {
  cotizacion: Cotizacion;
  cliente?: Cliente;
  empresa: { razonSocial: string; ruc: string | null; direccion?: string | null };
  datos: { enviarOrdenA: string; cuentas: CuentaPdf[]; cuentaDetraccion?: { numero: string; cci: string } | null };
}

const fechaPe = (iso: string) => iso.split('-').reverse().join('/');
/** Formato del Excel: 24,500.00 */
const num = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Cantidades como en el Excel: 2.0 */
const cant = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 3 });

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
  const M = 13; // margen interior (el marco va a 8 mm del borde)
  const q = d.cotizacion;
  const t = totalesCotizacion(q);
  const mon = q.moneda === 'USD' ? 'US$' : 'S/';
  const finTabla = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  // ── Encabezado: logo a la izquierda, empresa a la derecha ──────
  const logo = await cargarLogo();
  if (logo) doc.addImage(logo, 'PNG', M, 13, 64, 15.1, undefined, 'FAST');
  else doc.setFont('helvetica', 'bold').setFontSize(20).setTextColor(...CELESTE).text('COLD WORK', M, 24);

  doc.setTextColor(...NEGRO).setFont('helvetica', 'bold').setFontSize(9.5);
  const cx = 157;
  let yh = 15;
  const direccion = (d.empresa.direccion || DOCUMENTO_OC.direccion).toUpperCase();
  for (const l of [d.empresa.razonSocial.toUpperCase(), `RUC: ${d.empresa.ruc ?? DOCUMENTO_OC.ruc}`, ...doc.splitTextToSize(direccion, 77)]) {
    doc.text(l, cx, yh, { align: 'center' });
    yh += 4.6;
  }

  // ── Título ─────────────────────────────────────────────────────
  doc.setFontSize(14).text(`COTIZACIÓN N°  ${q.numero}`, W / 2 + 4, Math.max(yh + 3, 38), { align: 'center' });

  // ── Datos del cliente (dos columnas) ───────────────────────────
  let y = Math.max(yh + 3, 38) + 9;
  doc.setFontSize(8.8);
  const izq: [string, string][] = [
    ['Cliente', (d.cliente?.razonSocial ?? '').toUpperCase()],
    ['Atención', q.atencion],
    ['Celular', q.celular],
    ['Proyecto', q.proyecto],
    ['Ubicación', q.ubicacion],
  ];
  const der: [string, string][] = [
    ['Fecha', fechaPe(q.fecha)],
    ['Validez de oferta', `${q.validezDias} días`],
    ['Enviar orden a', d.datos.enviarOrdenA],
  ];
  izq.forEach(([k, v], i) => {
    doc.setFont('helvetica', 'bold').text(k, M + 2, y + i * 4.6);
    doc.setFont('helvetica', 'normal').text(`: ${v ?? ''}`.slice(0, 70), M + 26, y + i * 4.6);
  });
  der.forEach(([k, v], i) => {
    doc.setFont('helvetica', 'bold').text(k, 132, y + i * 4.6);
    doc.setFont('helvetica', 'normal').text(`: ${v ?? ''}`, 163, y + i * 4.6);
  });
  y += izq.length * 4.6 + 2;

  // ── Tabla de ítems ─────────────────────────────────────────────
  const fino = 0.15;
  const grueso = 0.35;
  const lados = { top: 0, bottom: 0, left: fino, right: fino };
  const filas: CellDef[][] = [];
  q.secciones.forEach((s, i) => {
    const sub = subtotalSeccion(s);
    filas.push([
      {
        content: `${i + 1}.0`,
        rowSpan: s.lineas.length + 2,
        styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 9.5, lineWidth: { top: grueso, bottom: grueso, left: grueso, right: grueso } },
      },
      { content: s.titulo.toUpperCase(), styles: { fontStyle: 'bold', fillColor: CELESTE, lineWidth: { top: grueso, left: fino } } },
      ...[0, 1, 2, 3].map(() => ({ content: '', styles: { fillColor: CELESTE, lineWidth: { top: grueso } } })),
    ]);
    for (const l of s.lineas) {
      filas.push([
        { content: l.descripcion, styles: { lineWidth: lados } },
        { content: l.unidad, styles: { halign: 'center', lineWidth: lados } },
        { content: cant(l.cantidad), styles: { halign: 'center', lineWidth: lados } },
        { content: num(l.precio), styles: { halign: 'right', lineWidth: lados } },
        { content: num(totalLinea(l)), styles: { halign: 'right', lineWidth: { ...lados, right: grueso } } },
      ]);
    }
    const borde = { top: grueso, bottom: grueso, left: fino, right: fino };
    filas.push([
      { content: `SUB TOTAL ${mon}`, styles: { halign: 'right', fontStyle: 'bold', lineWidth: borde } },
      { content: 'UND.', styles: { halign: 'center', fontStyle: 'bold', lineWidth: borde } },
      { content: '1.0', styles: { halign: 'center', fontStyle: 'bold', lineWidth: borde } },
      { content: num(sub), styles: { halign: 'right', fontStyle: 'bold', lineWidth: borde } },
      { content: num(sub), styles: { halign: 'right', fontStyle: 'bold', lineWidth: { ...borde, right: grueso } } },
    ]);
  });

  const encabezado = { fillColor: CELESTE, textColor: NEGRO, fontStyle: 'bold' as const, halign: 'center' as const, valign: 'middle' as const, lineWidth: grueso, lineColor: NEGRO };
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M, top: 16, bottom: 16 },
    theme: 'plain',
    head: [
      [
        { content: 'Item', rowSpan: 2, styles: encabezado },
        { content: 'Descripción', rowSpan: 2, styles: encabezado },
        { content: 'Unidad', rowSpan: 2, styles: encabezado },
        { content: 'Cantidad', rowSpan: 2, styles: encabezado },
        { content: 'Precio', colSpan: 2, styles: encabezado },
      ],
      [
        { content: 'unitario', styles: encabezado },
        { content: 'Total', styles: encabezado },
      ],
    ],
    body: filas,
    styles: { font: 'helvetica', fontSize: 8.3, cellPadding: { top: 0.45, bottom: 0.45, left: 1.4, right: 1.4 }, textColor: NEGRO, lineColor: NEGRO, overflow: 'linebreak' },
    columnStyles: { 0: { cellWidth: 16 }, 2: { cellWidth: 20 }, 3: { cellWidth: 20 }, 4: { cellWidth: 25 }, 5: { cellWidth: 26 } },
  });
  y = finTabla() + 5;

  // ── Inversión (pasa a otra hoja solo si no entra completa) ─────
  const notas = q.notas.split('\n').map((n) => n.trim()).filter(Boolean);
  const nCuentas = d.datos.cuentas.reduce((s, c) => s + (c.cci ? 2 : 1), 0) + (d.datos.cuentaDetraccion?.numero ? (d.datos.cuentaDetraccion.cci ? 2 : 1) : 0);
  const lineasIzq = (q.tiempoEntrega.trim() ? 1 : 0) + (q.hitos.length ? q.hitos.length + 1 : 0) + (notas.length ? notas.length + 1 : 0);
  const alto = Math.max(12 + lineasIzq * 4.4, 22.2 + (nCuentas ? 12.6 + nCuentas * 4.4 : 0));
  if (y + alto > H - 12) {
    doc.addPage();
    y = 18;
  }
  const xDer = 125; // columna de los montos (alineada con "unitario")
  const anchoEtq = W - M - xDer - 30;
  doc.setLineWidth(grueso).setDrawColor(...NEGRO);
  doc.rect(M, y, W - 2 * M, 6);
  doc.line(xDer - 18, y, xDer - 18, y + 6);
  doc.line(W - M - 30, y, W - M - 30, y + 6);
  doc.setFont('helvetica', 'bold').setFontSize(9);
  doc.text('INVERSIÓN', xDer - 20, y + 4.2, { align: 'right' });
  doc.text(`SUB TOTAL (${mon})`, xDer - 18 + (anchoEtq + 18) / 2, y + 4.2, { align: 'center' });
  doc.text(num(t.valorVenta), W - M - 1.5, y + 4.2, { align: 'right' });

  let yr = y + 6;
  doc.setLineWidth(fino);
  const filaMonto = (etq: string, valor: string, negrita = false, centrar = false) => {
    doc.setFont('helvetica', negrita ? 'bold' : 'normal').setFontSize(8.8);
    doc.rect(xDer - 18, yr, anchoEtq + 18, 5.4);
    doc.rect(W - M - 30, yr, 30, 5.4);
    doc.text(etq, centrar ? xDer - 18 + (anchoEtq + 18) / 2 : xDer - 16.5, yr + 3.9, { align: centrar ? 'center' : 'left' });
    doc.text(valor, W - M - 1.5, yr + 3.9, { align: 'right' });
    yr += 5.4;
  };
  filaMonto(`Valor de venta ${mon}`, num(t.valorVenta));
  filaMonto('I.G.V.        18%', num(t.igv));
  doc.setLineWidth(grueso);
  filaMonto(`TOTAL ${mon}`, num(t.total), true, true);

  // ── Condiciones y notas (izquierda) ────────────────────────────
  let yc = y + 12;
  const anchoIzq = xDer - 22 - M;
  const linea = (texto: string, opciones: { negrita?: boolean; rojo?: boolean } = {}) => {
    doc.setFont('helvetica', opciones.negrita ? 'bold' : 'normal').setFontSize(9).setTextColor(...(opciones.rojo ? ROJO : NEGRO));
    for (const p of doc.splitTextToSize(texto, anchoIzq)) {
      doc.text(p, M + 2, yc);
      yc += 4.4;
    }
    doc.setTextColor(...NEGRO);
  };
  if (q.tiempoEntrega.trim()) linea(`Tiempo de entrega: ${q.tiempoEntrega.trim()}`, { negrita: true });
  if (q.hitos.length) {
    linea('Forma de pago:', { negrita: true });
    for (const h of q.hitos) linea(`${h.descripcion} : ${h.porcentaje}%`);
  }
  if (notas.length) {
    linea('Notas :');
    for (const n of notas) linea(n, { rojo: true });
  }

  // ── Cuentas (derecha) ──────────────────────────────────────────
  let yb = yr + 8;
  const filasCuentas: [string, string, string][] = [];
  for (const c of d.datos.cuentas) {
    filasCuentas.push([c.banco.toUpperCase(), c.numero, c.moneda === 'USD' ? 'USD' : 'SOLES']);
    if (c.cci) filasCuentas.push(['CCI', c.cci, '']);
  }
  if (d.datos.cuentaDetraccion?.numero) {
    filasCuentas.push(['C. DETRACCIÓN', d.datos.cuentaDetraccion.numero, '']);
    if (d.datos.cuentaDetraccion.cci) filasCuentas.push(['CCI', d.datos.cuentaDetraccion.cci, '']);
  }
  if (filasCuentas.length) {
    if (yb + 6 + filasCuentas.length * 4.4 > H - 14) {
      doc.addPage();
      yb = 20;
    }
    doc.setFont('helvetica', 'bold').setFontSize(8.8);
    doc.text('Cuentas', xDer - 16.5, yb);
    doc.setLineWidth(0.2).line(xDer - 16.5, yb + 0.7, xDer - 16.5 + doc.getTextWidth('Cuentas'), yb + 0.7);
    doc.text('N°', xDer + 12, yb);
    yb += 4.6;
    doc.setFont('helvetica', 'normal');
    for (const [a, b, c] of filasCuentas) {
      doc.text(a, xDer - 16.5, yb);
      doc.text(b, xDer + 12, yb);
      if (c) doc.text(c, W - M - 4, yb, { align: 'right' });
      yb += 4.4;
    }
  }

  // ── Marco negro y numeración de páginas ────────────────────────
  const paginas = doc.getNumberOfPages();
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p);
    doc.setDrawColor(...NEGRO).setLineWidth(0.5).rect(8, 8, W - 16, H - 16);
    if (paginas > 1) {
      doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(90, 90, 90);
      doc.text(`${q.numero} · Página ${p} de ${paginas}`, W - 10, H - 4, { align: 'right' });
      doc.setTextColor(...NEGRO);
    }
  }

  doc.save(`${q.numero} - ${q.proyecto || 'cotizacion'}.pdf`.replace(/[\\/:*?"<>|]/g, '-'));
}
