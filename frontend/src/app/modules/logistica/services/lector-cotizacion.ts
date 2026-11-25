import { redondear } from '../../../core/utils/montos';

/**
 * Lector de cotizaciones de proveedores (PDF digital o texto pegado de WhatsApp).
 *
 * Cómo lee un PDF:
 *  1. pdf.js saca cada texto con su posición (x, y) en la página.
 *  2. Se arman las LÍNEAS juntando los textos que están a la misma altura.
 *  3. Se busca la fila de ENCABEZADOS de la tabla (CÓDIGO, CANT., U.M,
 *     DESCRIPCIÓN, MARCA, P. UNIT., P. TOTAL…) y su posición marca las columnas.
 *     Así funciona aunque cada proveedor ordene las columnas distinto.
 *  4. Cada línea debajo se reparte en columnas por su x hasta llegar a SUBTOTAL.
 *  5. Se leen RUC, n° de cotización, moneda y forma de pago del texto general.
 *
 * Nunca es 100 % exacto (cada proveedor tiene su formato): por eso la app
 * siempre muestra el resultado EDITABLE antes de generar la orden, y avisa
 * cuando algo no cuadra (cantidad × precio ≠ total, suma ≠ subtotal).
 */

export interface TextoPdf {
  str: string;
  x: number;
  y: number;
  ancho: number;
  pagina: number;
}

export interface ItemCotizado {
  codigo: string;
  descripcion: string;
  marca: string;
  unidad: string;
  cantidad: number;
  precio: number;
  total: number | null;
}

export interface CotizacionLeida {
  proveedor: { ruc: string | null; razonSocial: string | null };
  numero: string | null;
  fecha: string | null;
  moneda: 'PEN' | 'USD';
  formaPago: string | null;
  items: ItemCotizado[];
  subtotal: number | null;
  igv: number | null;
  total: number | null;
  /** Avisos para revisar antes de generar la orden. */
  avisos: string[];
}

// ---------------------------------------------------------------------
// Números: "1,079.94" · "1.079,94" · "$ 30.00" · "S/ 15" · "12"
// ---------------------------------------------------------------------
export function leerNumero(texto: string | undefined | null): number | null {
  if (!texto) return null;
  let t = texto.replace(/(US\$|S\/\.?|\$|USD|PEN|soles?)/gi, '').replace(/\s/g, '');
  if (!/\d/.test(t)) return null;
  t = t.replace(/[^\d.,-]/g, '');
  const coma = t.lastIndexOf(','),
    punto = t.lastIndexOf('.');
  if (coma > -1 && punto > -1) {
    // el separador que va al final es el decimal
    t = coma > punto ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  } else if (coma > -1) {
    // "1,079" = miles · "15,90" = decimal
    t =
      /,\d{3}$/.test(t) && t.split(',').length === 2 && t.length > 4
        ? t.replace(',', '')
        : t.replace(',', '.');
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}


// ---------------------------------------------------------------------
// Líneas de texto a partir de las posiciones
// ---------------------------------------------------------------------
interface Celda {
  t: string;
  x: number;
  fin: number;
}
interface Linea {
  pagina: number;
  y: number;
  celdas: Celda[];
  texto: string;
}

export function armarLineas(textos: TextoPdf[], tolerancia = 3): Linea[] {
  const orden = textos
    .filter((t) => t.str.trim())
    .sort((a, b) => a.pagina - b.pagina || b.y - a.y || a.x - b.x);
  const lineas: Linea[] = [];
  for (const t of orden) {
    const l = lineas.find((x) => x.pagina === t.pagina && Math.abs(x.y - t.y) <= tolerancia);
    const c = { t: t.str.trim(), x: t.x, fin: t.x + t.ancho };
    if (l) l.celdas.push(c);
    else lineas.push({ pagina: t.pagina, y: t.y, celdas: [c], texto: '' });
  }
  for (const l of lineas) {
    l.celdas.sort((a, b) => a.x - b.x);
    // une pedazos pegados ("NUC" "LEO" → "NUCLEO" no; solo si casi se tocan)
    const unidas: Celda[] = [];
    for (const c of l.celdas) {
      const u = unidas[unidas.length - 1];
      if (u && c.x - u.fin < 1.2) {
        u.t += c.t;
        u.fin = c.fin;
      } else unidas.push({ ...c });
    }
    l.celdas = unidas;
    l.texto = unidas.map((c) => c.t).join(' ');
  }
  return lineas;
}

// ---------------------------------------------------------------------
// Columnas de la tabla
// ---------------------------------------------------------------------
type Columna =
  'item' | 'codigo' | 'cantidad' | 'unidad' | 'descripcion' | 'marca' | 'precio' | 'total';

const ENCABEZADOS: [Columna, RegExp][] = [
  ['item', /^(ITEM|ÍTEM|N[°º]?|NRO\.?|#)$/i],
  ['codigo', /^(C[OÓ]D(IGO)?\.?|C[OÓ]D\.?\s*PROD\.?|SKU|MODELO|REF\.?)$/i],
  ['cantidad', /^(CANT(IDAD)?\.?|CANT\.)$/i],
  ['unidad', /^(U\.?\s*M\.?|UND\.?|UNID(AD)?\.?|MED(IDA)?\.?|U\/M)$/i],
  ['descripcion', /^(DESCRIPCI[OÓ]N|DESCRIPCION|DETALLE|PRODUCTO|ART[IÍ]CULO)$/i],
  ['marca', /^(MARCA|FABRICANTE)$/i],
  [
    'precio',
    /^(P\.?\s*UNIT\.?(ARIO)?|PRECIO(\s*UNIT\.?(ARIO)?)?|P\.?\s*U\.?|V\.?\s*UNIT\.?(ARIO)?|COSTO\s*UNIT\.?)$/i,
  ],
  ['total', /^(P\.?\s*TOTAL|TOTAL|IMPORTE|V\.?\s*VENTA|SUB\s*TOTAL|VALOR\s*VENTA)$/i],
];

function tipoEncabezado(t: string): Columna | null {
  const limpio = t.replace(/\s+/g, ' ').trim();
  for (const [col, re] of ENCABEZADOS) if (re.test(limpio)) return col;
  return null;
}

interface PosColumna {
  col: Columna;
  centro: number;
}

/** Busca la fila de encabezados: la que tiene CANT y DESCRIPCIÓN (o PRECIO). */
function buscarEncabezado(lineas: Linea[]): { indice: number; columnas: PosColumna[] } | null {
  for (let i = 0; i < lineas.length; i++) {
    const cols: PosColumna[] = [];
    for (const c of lineas[i].celdas) {
      const tipo = tipoEncabezado(c.t);
      if (tipo && !cols.some((x) => x.col === tipo))
        cols.push({ col: tipo, centro: (c.x + c.fin) / 2 });
    }
    const tiene = (c: Columna) => cols.some((x) => x.col === c);
    if (cols.length >= 3 && tiene('cantidad') && (tiene('descripcion') || tiene('precio'))) {
      return { indice: i, columnas: cols.sort((a, b) => a.centro - b.centro) };
    }
  }
  return null;
}

/** A qué columna pertenece una celda: la de centro más cercano. */
function columnaDe(c: Celda, columnas: PosColumna[]): Columna {
  const centro = (c.x + c.fin) / 2;
  let mejor = columnas[0];
  for (const col of columnas)
    if (Math.abs(col.centro - centro) < Math.abs(mejor.centro - centro)) mejor = col;
  // Un texto largo que empieza cerca de la descripción es descripción
  const desc = columnas.find((x) => x.col === 'descripcion');
  if (desc && c.fin - c.x > 60 && c.x < desc.centro && c.fin > desc.centro) return 'descripcion';
  return mejor.col;
}

const FIN_TABLA =
  /^(SUB\s*TOTAL|TOTAL|I\.?G\.?V|SON\b|OBSERVACI|CONDICIONES|NOTA|VALOR\s+VENTA|STOCK)/i;

// ---------------------------------------------------------------------
// Lectura principal (PDF)
// ---------------------------------------------------------------------
export function leerDesdeTextos(textos: TextoPdf[], rucPropio?: string | null): CotizacionLeida {
  const lineas = armarLineas(textos);
  const todo = lineas.map((l) => l.texto).join('\n');
  const r = leerCabecera(todo, lineas, rucPropio);
  const enc = buscarEncabezado(lineas);

  if (!enc) {
    r.avisos.push(
      'No encontré la tabla con encabezados (CANT., DESCRIPCIÓN, P. UNIT.). Leí las líneas una por una: revisa con cuidado.',
    );
    r.items = leerTextoLibre(lineas.map((l) => l.texto).join('\n')).items;
  } else {
    let actual: ItemCotizado | null = null;
    for (let i = enc.indice + 1; i < lineas.length; i++) {
      const l = lineas[i];
      if (
        FIN_TABLA.test(l.texto) ||
        l.celdas.some((c) => /^(SUB\s*TOTAL|I\.?G\.?V\.?\s*\d*%?)$/i.test(c.t))
      )
        break;
      const fila: Partial<Record<Columna, string>> = {};
      for (const c of l.celdas) {
        if (/^(\$|S\/\.?|US\$)$/.test(c.t)) continue; // símbolo de moneda suelto
        const col = columnaDe(c, enc.columnas);
        fila[col] = fila[col] ? `${fila[col]} ${c.t}` : c.t;
      }
      const cantidad = leerNumero(fila.cantidad);
      const precio = leerNumero(fila.precio);
      const total = leerNumero(fila.total);
      if (cantidad && cantidad > 0 && (precio !== null || total !== null)) {
        actual = {
          codigo: (fila.codigo ?? '').trim(),
          descripcion: (fila.descripcion ?? '').trim(),
          marca: (fila.marca ?? '').trim(),
          unidad: normalizarUnidad(fila.unidad),
          cantidad,
          precio: precio ?? redondear((total ?? 0) / cantidad),
          total,
        };
        r.items.push(actual);
      } else if (actual && fila.descripcion && !cantidad) {
        // Descripción en dos líneas
        actual.descripcion = `${actual.descripcion} ${fila.descripcion}`.trim();
      }
    }
  }
  return validar(r);
}

function leerCabecera(todo: string, lineas: Linea[], rucPropio?: string | null): CotizacionLeida {
  const rucs = [...todo.matchAll(/\b((?:10|15|17|20)\d{9})\b/g)].map((m) => m[1]);
  const rucProveedor = rucs.find((x) => x !== rucPropio) ?? null;

  // Razón social: la primera línea con S.A.C., E.I.R.L., S.R.L., S.A. que no sea la nuestra
  const formaSocietaria =
    /\b(S\.?\s?A\.?\s?C\.?|E\.?\s?I\.?\s?R\.?\s?L\.?|S\.?\s?R\.?\s?L\.?|S\.?\s?A\.?)\s*$/i;
  let razon: string | null = null;
  for (const l of lineas.slice(0, 25)) {
    const t = l.texto.replace(/^(RAZ[OÓ]N SOCIAL|SE[ÑN]OR(ES)?|CLIENTE)\s*:?\s*/i, '').trim();
    if (formaSocietaria.test(t) && !/COLD\s*WORK/i.test(t) && t.length < 80) {
      razon = t;
      break;
    }
  }

  const numero =
    todo
      .match(/COTIZACI[OÓ]N\s*(?:N[°º.o]?\s*)?[:#]?\s*([A-Z]{0,4}[\s-]?\d{2,}[\w-]*)/i)?.[1]
      ?.replace(/\s+/g, ' ')
      .trim() ?? null;
  const fecha = todo.match(/FECHA\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i)?.[1] ?? null;
  const moneda: 'PEN' | 'USD' = /D[OÓ]LAR|US\s?\$|\bUSD\b/i.test(todo) ? 'USD' : 'PEN';
  const formaPago =
    todo
      .match(/(?:FORMA|CONDICI[OÓ]N(?:ES)?)\s+DE\s+PAGO\s*:?\s*([^\n]+?)(?:\s{2,}|\n|$)/i)?.[1]
      ?.trim() ?? null;

  /** Monto a la derecha de una etiqueta (SUBTOTAL, IGV, TOTAL), aunque comparta línea con otro texto. */
  const montoTras = (re: RegExp) => {
    for (const l of lineas) {
      const i = l.celdas.findIndex((c) => re.test(c.t));
      if (i < 0) continue;
      const nums = l.celdas
        .slice(i + 1)
        .map((c) => leerNumero(c.t))
        .filter((n): n is number => n !== null && n > 0);
      if (nums.length) return nums[nums.length - 1];
    }
    return null;
  };

  return {
    proveedor: { ruc: rucProveedor, razonSocial: razon },
    numero,
    fecha: fecha ? aISO(fecha) : null,
    moneda,
    formaPago: formaPago
      ? formaPago.charAt(0).toUpperCase() + formaPago.slice(1).toLowerCase()
      : null,
    items: [],
    subtotal: montoTras(/^(SUB\s*TOTAL|VALOR\s*(DE\s*)?VENTA|OP\.?\s*GRAVADA)\s*:?$/i),
    igv: montoTras(/^I\.?\s*G\.?\s*V\.?(\s*\(?\d+(\.\d+)?\s*%\)?)?\s*:?$/i),
    total: montoTras(/^(IMPORTE\s+)?TOTAL(\s+A\s+PAGAR)?\s*:?$/i),
    avisos: [],
  };
}

function aISO(f: string): string | null {
  const m = f.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (!m) return null;
  const anio = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${anio}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

/** Unidades de SUNAT y de proveedores → las del catálogo. */
export function normalizarUnidad(u: string | undefined): string {
  const t = (u ?? '').toUpperCase().replace(/\./g, '').trim();
  const mapa: Record<string, string> = {
    NIU: 'UND',
    UND: 'UND',
    UNID: 'UND',
    UNIDAD: 'UND',
    U: 'UND',
    PZA: 'UND',
    PZ: 'UND',
    PIEZA: 'UND',
    GLN: 'GAL',
    GAL: 'GAL',
    GALON: 'GAL',
    KGM: 'KG',
    KG: 'KG',
    LBR: 'LB',
    LB: 'LB',
    MTR: 'M',
    M: 'M',
    MT: 'M',
    LTR: 'LT',
    LT: 'LT',
    L: 'LT',
    BAL: 'BAL',
    BALON: 'BAL',
    JGO: 'JGO',
    JUEGO: 'JGO',
    KIT: 'KIT',
    CJ: 'CAJA',
    CAJA: 'CAJA',
    ROLLO: 'ROLLO',
    RLL: 'ROLLO',
  };
  return mapa[t] ?? (t || 'UND');
}

// ---------------------------------------------------------------------
// Texto pegado (mensaje de WhatsApp, correo, Excel)
// ---------------------------------------------------------------------
/**
 * Entiende líneas como:
 *   "12 und 023U1921 48-F NUC IMP DANFOSS $30.00"
 *   "Filtro secador C165 x2 ... S/ 14.00"
 *   "3 - Aceite mineral 3GS 4L - 15.90"
 * Regla: una cantidad al inicio (o "x2") y un precio al final.
 */
export function leerTextoLibre(texto: string): CotizacionLeida {
  const r: CotizacionLeida = {
    proveedor: { ruc: null, razonSocial: null },
    numero: null,
    fecha: null,
    moneda: /D[OÓ]LAR|US\s?\$|\$|\bUSD\b/i.test(texto) && !/S\/|SOLES/i.test(texto) ? 'USD' : 'PEN',
    formaPago: null,
    items: [],
    subtotal: null,
    igv: null,
    total: null,
    avisos: [],
  };
  const ruc = texto.match(/\b((?:10|15|17|20)\d{9})\b/);
  if (ruc && !/COLD\s*WORK/i.test(texto.slice(Math.max(0, (ruc.index ?? 0) - 40), ruc.index)))
    r.proveedor.ruc = ruc[1];

  for (const cruda of texto.split(/\r?\n/)) {
    const l = cruda
      .replace(/[*_~•▪►]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!l || FIN_TABLA.test(l)) continue;
    // precio al final (con o sin moneda); puede haber precio unitario y total
    const precios = [
      ...l.matchAll(
        /(?:US\$|S\/\.?|\$)?\s?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})|\d+(?:[.,]\d{1,2})?)\s*$/g,
      ),
    ];
    const fin =
      l.match(/(?:US\$|S\/\.?|\$)\s?([\d.,]+)\s*(?:(?:US\$|S\/\.?|\$)\s?([\d.,]+))?\s*$/) ??
      (precios.length ? [precios[0][0], precios[0][1]] : null);
    if (!fin) continue;
    let resto = l.slice(0, l.lastIndexOf(fin[0])).trim();
    // un segundo precio solo cuenta si también tiene símbolo de moneda ("$30.00 $360.00")
    const dos = resto.match(/(?:US\$|S\/\.?|\$)\s?([\d.,]+)\s*$/);
    let precio = leerNumero(fin[1]);
    let total = fin[2] ? leerNumero(fin[2]) : null;
    if (!fin[2] && dos) {
      // "... $30.00 $360.00": el primero es unitario
      total = precio;
      precio = leerNumero(dos[1]);
      resto = resto.slice(0, resto.lastIndexOf(dos[0])).trim();
    }
    resto = resto.replace(/^\d{1,2}[.)]\s+/, ''); // numeración "1)" / "2."
    // cantidad: al inicio "12", "12 und", "12 x" o "x12" en cualquier parte
    let cantidad: number | null = null;
    let unidad = 'UND';
    const ini = resto.match(
      /^(\d+(?:[.,]\d+)?)\s*(und|unid|unidades|pzas?|niu|gal|gln|kg|m|mts?|rollos?|bal|jgo|kit|x)?\b\s*[-–:]?\s*/i,
    );
    const xN = resto.match(/\bx\s?(\d+)\b/i);
    if (xN) {
      cantidad = Number(xN[1]);
      resto = resto.replace(xN[0], ' ');
    } else if (ini) {
      cantidad = leerNumero(ini[1]);
      if (ini[2] && ini[2].toLowerCase() !== 'x') unidad = normalizarUnidad(ini[2]);
      resto = resto.slice(ini[0].length);
    }
    if (!cantidad || !precio) continue;
    resto = resto.replace(/\s*[-–:|]\s*$/, '').trim();
    const codigo = resto.match(/^([A-Z0-9]{2,}[-./]?[A-Z0-9-]*\d[A-Z0-9-]*)\s+/i)?.[1] ?? '';
    r.items.push({
      codigo,
      descripcion: (codigo ? resto.slice(codigo.length) : resto).trim(),
      marca: '',
      unidad,
      cantidad,
      precio,
      total,
    });
  }
  if (!r.items.length)
    r.avisos.push(
      'No reconocí productos. Formato esperado por línea: cantidad, descripción y precio al final (ej. "12 und Filtro DML 083 $58.00").',
    );
  return validar(r);
}

// ---------------------------------------------------------------------
// Validación: ¿cuadra lo leído?
// ---------------------------------------------------------------------
function validar(r: CotizacionLeida): CotizacionLeida {
  r.items.forEach((it, i) => {
    if (it.total !== null && Math.abs(redondear(it.cantidad * it.precio) - it.total) > 0.05) {
      r.avisos.push(
        `Fila ${i + 1} (${it.descripcion || it.codigo}): ${it.cantidad} × ${it.precio} no da ${it.total}. Revisa cantidad o precio.`,
      );
    }
  });
  const suma = redondear(r.items.reduce((t, it) => t + it.cantidad * it.precio, 0));
  if (r.subtotal !== null && r.items.length && Math.abs(suma - r.subtotal) > 0.1) {
    r.avisos.push(
      `La suma de los productos (${suma.toFixed(2)}) no coincide con el subtotal de la cotización (${r.subtotal.toFixed(2)}). Puede faltar una fila.`,
    );
  }
  if (!r.proveedor.ruc) r.avisos.push('No encontré el RUC del proveedor: elígelo de la lista.');
  return r;
}

// ---------------------------------------------------------------------
// PDF → textos con posición (pdf.js, se carga solo cuando se usa)
// ---------------------------------------------------------------------
export async function textosDePdf(datos: ArrayBuffer): Promise<TextoPdf[]> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs/pdf.worker.min.mjs', document.baseURI).href;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(datos) }).promise;
  const salida: TextoPdf[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const pagina = await doc.getPage(p);
    const contenido = await pagina.getTextContent();
    for (const it of contenido.items) {
      if (!('str' in it)) continue;
      salida.push({
        str: it.str,
        x: it.transform[4],
        y: it.transform[5],
        ancho: it.width,
        pagina: p,
      });
    }
  }
  if (!salida.some((t) => t.str.trim())) {
    throw new Error(
      'El PDF no tiene texto (parece una foto o un escaneo). Pega el texto o escribe los productos a mano.',
    );
  }
  return salida;
}

export async function leerPdf(archivo: File, rucPropio?: string | null): Promise<CotizacionLeida> {
  return leerDesdeTextos(await textosDePdf(await archivo.arrayBuffer()), rucPropio);
}
