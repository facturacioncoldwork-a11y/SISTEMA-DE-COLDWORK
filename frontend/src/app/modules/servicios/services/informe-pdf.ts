import { DOCUMENTO_OC } from '../../logistica/config/documento-oc';
import { ATS, MEDICIONES, TIPOS_SERVICIO } from '../data/catalogos';
import type { Cliente, Equipo, OrdenTrabajo, Tecnico } from '../models/servicios.model';

/**
 * PDF formal del INFORME TÉCNICO DE SERVICIO (formato COLD WORK).
 * Incluye datos del cliente y del equipo, ATS, mediciones, trabajos, repuestos,
 * registro fotográfico y firmas. jsPDF se carga solo al generar (no pesa en la app).
 * Las fotos se reducen a 1200 px para que el archivo sea liviano de enviar.
 */

const AZUL: [number, number, number] = [10, 64, 140];
const GRIS: [number, number, number] = [100, 110, 125];
const FONDO: [number, number, number] = [240, 245, 250];

export interface DatosInformePdf {
  orden: OrdenTrabajo;
  cliente?: Cliente;
  equipo?: Equipo;
  tecnicos: Tecnico[];
  empresa: { razonSocial: string; ruc: string | null };
}

const fechaPe = (iso?: string) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—');
const horaDe = (iso?: string) => (iso && iso.length > 10 ? iso.slice(11, 16) : '—');

/** Imagen (blob: o data:) reducida a JPEG para el PDF. */
async function aJpeg(url: string, maximo = 1200): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const escala = Math.min(1, maximo / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * escala);
    c.height = Math.round(img.naturalHeight * escala);
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return { data: c.toDataURL('image/jpeg', 0.82), w: c.width, h: c.height };
  } catch {
    return null;
  }
}

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

export async function descargarInformePdf(d: DatosInformePdf): Promise<void> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;
  const H = 297;
  const M = 14;
  const o = d.orden;
  const i = o.informe;

  // ── Encabezado ────────────────────────────────────────────────
  const logo = await cargarLogo();
  if (logo) doc.addImage(logo, 'PNG', M, 10, 52, 12.3, undefined, 'FAST');
  else doc.setFont('helvetica', 'bold').setFontSize(18).setTextColor(...AZUL).text('COLD WORK', M, 19);
  doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...GRIS);
  doc.text(DOCUMENTO_OC.direccion, M, 27);
  doc.text(`CEL: ${DOCUMENTO_OC.celular}`, M, 30.5);

  doc.setTextColor(0, 0, 0).setFont('helvetica', 'bold').setFontSize(13);
  doc.text('INFORME TÉCNICO DE SERVICIO', W - M, 15, { align: 'right' });
  doc.setFontSize(10).text(o.numero, W - M, 21, { align: 'right' });
  doc.setFont('helvetica', 'normal').setFontSize(8);
  doc.text(`${d.empresa.razonSocial} · RUC ${d.empresa.ruc ?? DOCUMENTO_OC.ruc}`, W - M, 26, { align: 'right' });
  doc.text(`Fecha: ${fechaPe(o.fecha)}`, W - M, 30.5, { align: 'right' });
  doc.setDrawColor(...AZUL).setLineWidth(0.6).line(M, 34, W - M, 34);

  let y = 39;
  const titulo = (texto: string) => {
    if (y > H - 40) {
      doc.addPage();
      y = 18;
    }
    doc.setFillColor(...AZUL).rect(M, y, W - 2 * M, 6.5, 'F');
    doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(255, 255, 255).text(texto, M + 2.5, y + 4.5);
    doc.setTextColor(0, 0, 0);
    y += 8.5;
  };
  const tabla = (body: (string | number)[][], head?: string[], anchos?: Record<number, number>) => {
    autoTable(doc, {
      startY: y,
      head: head ? [head] : undefined,
      body: body.map((f) => f.map(String)),
      margin: { left: M, right: M },
      theme: 'grid',
      styles: { fontSize: 8.3, cellPadding: 1.8, lineColor: [210, 218, 228], lineWidth: 0.2, textColor: [20, 30, 45] },
      headStyles: { fillColor: FONDO, textColor: [20, 30, 45], fontStyle: 'bold' },
      columnStyles: anchos ? Object.fromEntries(Object.entries(anchos).map(([k, w]) => [k, { cellWidth: w }])) : undefined,
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
  };
  const parrafo = (texto: string) => {
    const lineas = doc.setFont('helvetica', 'normal').setFontSize(8.8).splitTextToSize(texto || '—', W - 2 * M - 4);
    for (const l of lineas) {
      if (y > H - 20) {
        doc.addPage();
        y = 18;
      }
      doc.text(l, M + 2, y);
      y += 4.4;
    }
    y += 2.5;
  };

  // ── 1. Datos del servicio ─────────────────────────────────────
  titulo('1. DATOS DEL SERVICIO');
  tabla(
    [
      ['Cliente', d.cliente?.razonSocial ?? '—', 'RUC', d.cliente?.ruc ?? '—'],
      ['Dirección', d.cliente?.direccion ?? '—', 'Contacto', d.cliente?.contacto ?? '—'],
      ['Tipo de servicio', TIPOS_SERVICIO[o.tipo].nombre, 'Horario', `${horaDe(i.inicio)} a ${horaDe(i.fin)}`],
      ['Equipo', `${d.equipo?.tipo ?? ''} · ${d.equipo?.codigo ?? ''}`, 'Marca / modelo', `${d.equipo?.marca ?? ''} ${d.equipo?.modelo ?? ''}`],
      ['N.° de serie', d.equipo?.serie ?? '—', 'Refrigerante', `${d.equipo?.refrigerante ?? ''} · ${d.equipo?.capacidad ?? ''}`],
      ['Ubicación', d.equipo?.ubicacion ?? '—', 'Técnicos', d.tecnicos.map((t) => t.nombre).join(', ')],
    ],
    undefined,
    { 0: 30, 1: 62, 2: 28 },
  );
  doc.setFont('helvetica', 'bold').setFontSize(8.5).text('Reporte del cliente:', M + 2, y);
  y += 4.5;
  parrafo(o.descripcion);

  // ── 2. Seguridad ──────────────────────────────────────────────
  titulo('2. ANÁLISIS DE TRABAJO SEGURO (ATS)');
  tabla(ATS.map((a) => [a.texto, i.ats[a.clave] ? 'Sí' : 'No']), ['Verificación', 'Cumple'], { 1: 22 });

  // ── 3. Diagnóstico y mediciones ───────────────────────────────
  titulo('3. DIAGNÓSTICO Y MEDICIONES');
  tabla(
    i.mediciones.map((m) => {
      const def = MEDICIONES.find((x) => x.clave === m.clave);
      return [def?.nombre ?? m.clave, m.valor === null ? '—' : `${m.valor} ${def?.unidad ?? ''}`];
    }),
    ['Medición', 'Valor'],
    { 1: 40 },
  );
  doc.setFont('helvetica', 'bold').setFontSize(8.5).text('Diagnóstico:', M + 2, y);
  y += 4.5;
  parrafo(i.diagnostico);

  // ── 4. Trabajos realizados ────────────────────────────────────
  titulo('4. TRABAJOS REALIZADOS');
  parrafo(i.trabajos);
  if (i.repuestos.length) tabla(i.repuestos.map((r, n) => [n + 1, r.descripcion, `${r.cantidad} ${r.unidad}`]), ['N.°', 'Repuesto / material', 'Cantidad'], { 0: 12, 2: 28 });
  tabla(
    [
      ['Refrigerante cargado', i.gasCargadoKg === null ? '—' : `${i.gasCargadoKg} kg`],
      ['Refrigerante recuperado', i.gasRecuperadoKg === null ? '—' : `${i.gasRecuperadoKg} kg`],
      ['Estado final del equipo', i.equipoOperativo === null ? '—' : i.equipoOperativo ? 'OPERATIVO' : 'INOPERATIVO'],
    ],
    undefined,
    { 0: 60 },
  );

  // ── 5. Registro fotográfico ───────────────────────────────────
  if (i.fotos.length) {
    titulo('5. REGISTRO FOTOGRÁFICO');
    const ancho = (W - 2 * M - 8) / 3;
    let col = 0;
    for (const f of i.fotos) {
      const img = await aJpeg(f.url);
      if (!img) continue;
      const alto = Math.min(ancho * (img.h / img.w), 60);
      if (y + alto + 8 > H - 18) {
        doc.addPage();
        y = 18;
        col = 0;
      }
      const x = M + col * (ancho + 4);
      doc.addImage(img.data, 'JPEG', x, y, ancho, alto, undefined, 'FAST');
      doc.setFontSize(7.5).setTextColor(...GRIS).text(f.etapa === 'despues' ? 'Después' : f.etapa === 'antes' ? 'Antes' : 'Durante', x, y + alto + 3.5);
      doc.setTextColor(0, 0, 0);
      col++;
      if (col === 3) {
        col = 0;
        y += 66;
      }
    }
    if (col) y += 66;
  }

  // ── 6. Recomendaciones y conformidad ──────────────────────────
  titulo(`${i.fotos.length ? 6 : 5}. RECOMENDACIONES Y CONFORMIDAD`);
  parrafo(i.recomendaciones);
  if (y > H - 55) {
    doc.addPage();
    y = 20;
  }
  y += 18;
  const mitad = (W - 2 * M) / 2;
  if (i.firmaCliente) doc.addImage(i.firmaCliente, 'PNG', M + mitad + 10, y - 22, mitad - 20, 20, undefined, 'FAST');
  doc.setDrawColor(0, 0, 0).setLineWidth(0.3);
  doc.line(M + 8, y, M + mitad - 8, y);
  doc.line(M + mitad + 8, y, W - M - 8, y);
  doc.setFont('helvetica', 'bold').setFontSize(8);
  doc.text(d.tecnicos[0]?.nombre ?? 'Técnico responsable', M + mitad / 2, y + 4, { align: 'center' });
  doc.text(i.firmaNombre || 'Cliente', M + mitad * 1.5, y + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...GRIS);
  doc.text('Técnico responsable · COLD WORK', M + mitad / 2, y + 8, { align: 'center' });
  doc.text(`Conformidad del cliente${i.firmaDni ? ` · DNI ${i.firmaDni}` : ''}`, M + mitad * 1.5, y + 8, { align: 'center' });

  // ── Pie de página ─────────────────────────────────────────────
  const paginas = doc.getNumberOfPages();
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p);
    doc.setFontSize(7).setTextColor(...GRIS);
    doc.text(`${o.numero} · Informe técnico · ${d.empresa.razonSocial}`, M, H - 8);
    doc.text(`Página ${p} de ${paginas}`, W - M, H - 8, { align: 'right' });
  }

  doc.save(`informe-tecnico-${o.numero}.pdf`);
}
