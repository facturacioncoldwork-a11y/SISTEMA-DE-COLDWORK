import { DatePipe, DecimalPipe } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TooltipModule } from 'primeng/tooltip';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { EmpresaActualService } from '../../../../core/empresa/services/empresa-actual.service';
import { DOCUMENTO_OC } from '../../config/documento-oc';
import {
  SIMBOLO,
  TIPOS_PRODUCTO,
  type Moneda,
  type OrdenCompra,
  type Producto,
  type TipoProducto,
} from '../../models/logistica.model';
import { hoyISO } from '../../models/plazos';
import { leerPdf, leerTextoLibre, type CotizacionLeida } from '../../services/lector-cotizacion';
import { LogisticaStore, mensajeError } from '../../services/logistica-store.service';
import { crearPdfOrden, totalesOrden, type DatosOrdenPdf } from '../../services/orden-pdf';
import { OrdenesCompraService } from '../../services/ordenes-compra.service';
import { ProductosService } from '../../services/productos.service';
import { ProveedoresService } from '../../services/proveedores.service';
import { PlazoEntrega, type ValorPlazo } from '../plazo-entrega/plazo-entrega';
import { VistaPdf } from '../vista-pdf/vista-pdf';

/** Una fila de la cotización, editable. */
interface Fila {
  id: number;
  incluir: boolean;
  codigo: string;
  descripcion: string;
  marca: string;
  unidad: string;
  cantidad: number;
  precio: number;
  /** id de producto del catálogo, o 'nuevo' (se crea al guardar). */
  productoId: string;
  tipo: TipoProducto;
  /** Cómo se emparejó, para mostrarlo. */
  emparejado: 'codigo' | 'nombre' | 'nuevo' | 'manual';
}

const NUEVO = 'nuevo';
const NUEVO_PROVEEDOR = '__nuevo__';
let secuencia = 0;

/**
 * IMPORTAR COTIZACIÓN → ORDEN DE COMPRA (formato COLD WORK).
 *  1. Cargar: PDF de la cotización (el que llega por WhatsApp) o texto pegado.
 *  2. Revisar y editar: qué productos se compran, cantidades, precios, proveedor,
 *     plazo, condiciones… (no siempre se compra todo lo cotizado).
 *  3. Vista previa del PDF y guardar: crea lo que falte (proveedor, productos),
 *     guarda la orden y descarga el PDF con su número.
 */
@Component({
  selector: 'app-importar-cotizacion',
  imports: [
    FormsModule,
    DatePipe,
    DecimalPipe,
    DialogModule,
    SelectModule,
    SelectButtonModule,
    TooltipModule,
    PlazoEntrega,
    VistaPdf,
  ],
  templateUrl: './importar-cotizacion.html',
  styleUrl: './importar-cotizacion.scss',
})
export class ImportarCotizacion {
  protected readonly store = inject(LogisticaStore);
  private readonly empresa = inject(EmpresaActualService);
  private readonly auth = inject(AuthService);
  private readonly ocApi = inject(OrdenesCompraService);
  private readonly productosApi = inject(ProductosService);
  private readonly proveedoresApi = inject(ProveedoresService);

  readonly visible = model(false);
  readonly guardada = output<OrdenCompra>();

  protected readonly simbolo = SIMBOLO;
  protected readonly tipos = Object.entries(TIPOS_PRODUCTO).map(([clave, t]) => ({
    clave: clave as TipoProducto,
    nombre: t.nombre,
  }));
  protected readonly monedas = [
    { t: 'US$ Dólares', v: 'USD' },
    { t: 'S/ Soles', v: 'PEN' },
  ];

  // ---------- Estado ----------
  protected readonly paso = signal<1 | 2 | 3>(1);
  protected readonly modo = signal<'pdf' | 'texto'>('pdf');
  protected readonly texto = signal('');
  protected readonly arrastrando = signal(false);
  protected readonly leyendo = signal(false);
  protected readonly archivo = signal<string | null>(null);
  protected readonly lectura = signal<CotizacionLeida | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly filas = signal<Fila[]>([]);
  protected readonly proveedorId = signal<string | null>(null);
  protected readonly nuevoRuc = signal('');
  protected readonly nuevaRazon = signal('');
  protected readonly moneda = signal<Moneda>('USD');
  protected readonly cotizacionRef = signal('');
  /** Fecha de la cotización del proveedor (se lee del PDF si la trae). */
  protected readonly cotizacionFecha = signal('');
  protected readonly hoy = hoyISO();
  protected readonly condiciones = signal<string>(DOCUMENTO_OC.condicionesPorDefecto);
  protected readonly atencion = signal('');
  protected readonly solicitado = signal('');
  protected readonly lugar = signal<string>(DOCUMENTO_OC.lugarEntregaPorDefecto);
  protected readonly almacenId = signal<string | null>(null);
  protected readonly conIgv = signal(false);
  protected readonly plazo = signal<ValorPlazo>({
    plazoTexto: '',
    entregaDesde: null,
    entregaHasta: null,
  });
  protected readonly notas = signal('');

  protected readonly pdf = signal<ArrayBuffer | null>(null);
  protected readonly generando = signal(false);
  protected readonly guardando = signal(false);
  protected readonly progreso = signal('');

  // ---------- Derivados ----------
  protected readonly opcionesProveedor = computed(() => [
    { id: NUEVO_PROVEEDOR, razonSocial: '➕ Registrar proveedor nuevo', numeroDocumento: '' },
    ...this.store.proveedoresActivos(),
  ]);
  protected readonly opcionesProducto = computed(() => [
    { id: NUEVO, etiqueta: '➕ Crear producto nuevo' },
    ...this.store.productosActivos().map((p) => ({ id: p.id, etiqueta: `${p.sku} · ${p.nombre}` })),
  ]);
  protected readonly elegidas = computed(() => this.filas().filter((f) => f.incluir));
  protected readonly precioNeto = (f: Fila) =>
    this.conIgv() ? Math.round((f.precio / 1.18) * 10000) / 10000 : f.precio;
  protected readonly totales = computed(() =>
    totalesOrden(
      this.elegidas().map((f) => ({
        codigo: '',
        descripcion: '',
        unidad: '',
        cantidad: f.cantidad || 0,
        precio: this.precioNeto(f),
      })),
    ),
  );
  protected readonly nuevos = computed(
    () => this.elegidas().filter((f) => f.productoId === NUEVO).length,
  );
  protected readonly proveedorNuevo = computed(() => this.proveedorId() === NUEVO_PROVEEDOR);
  protected readonly nombreProveedor = computed(() =>
    this.proveedorNuevo()
      ? this.nuevaRazon()
      : (this.store.proveedores().find((p) => p.id === this.proveedorId())?.razonSocial ?? ''),
  );

  constructor() {
    effect(() => {
      if (!this.visible()) return;
      // Solo se reinicia al ABRIR (o al cambiar lo que se abre). Lo demás se lee sin
      // suscribirse: si no, recargar los catálogos a mitad de un guardado borraba el formulario.
      untracked(() => {
        this.reiniciar();
      });
    });
  }

  private reiniciar() {
    this.paso.set(1);
    this.modo.set('pdf');
    this.texto.set('');
    this.archivo.set(null);
    this.lectura.set(null);
    this.error.set(null);
    this.filas.set([]);
    this.pdf.set(null);
    this.proveedorId.set(null);
    this.nuevoRuc.set('');
    this.nuevaRazon.set('');
    this.moneda.set('USD');
    this.cotizacionRef.set('');
    this.cotizacionFecha.set('');
    this.condiciones.set(DOCUMENTO_OC.condicionesPorDefecto);
    this.atencion.set('');
    this.solicitado.set(this.auth.nombre());
    this.lugar.set(DOCUMENTO_OC.lugarEntregaPorDefecto);
    this.almacenId.set(
      this.store.almacenesActivos().find((a) => a.tipo === 'principal')?.id ?? null,
    );
    this.conIgv.set(false);
    this.notas.set('');
  }

  // ---------- Paso 1: cargar ----------
  protected async alSoltar(e: DragEvent) {
    e.preventDefault();
    this.arrastrando.set(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) await this.leerArchivo(f);
  }

  protected async alElegir(e: Event) {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (f) await this.leerArchivo(f);
  }

  private async leerArchivo(f: File) {
    if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') {
      this.error.set(
        'Por ahora se leen archivos PDF. Si te mandaron una foto, copia el texto del chat en "Pegar texto".',
      );
      return;
    }
    this.archivo.set(f.name);
    await this.leer(() => leerPdf(f, this.empresa.actual()?.ruc ?? DOCUMENTO_OC.ruc));
  }

  protected async leerTexto() {
    if (!this.texto().trim()) return this.error.set('Pega el texto de la cotización.');
    await this.leer(async () => leerTextoLibre(this.texto()));
  }

  protected enBlanco() {
    this.lectura.set({
      proveedor: { ruc: null, razonSocial: null },
      numero: null,
      fecha: null,
      moneda: 'USD',
      formaPago: null,
      items: [],
      subtotal: null,
      igv: null,
      total: null,
      avisos: [],
    });
    this.filas.set([]);
    this.agregarFila();
    this.paso.set(2);
  }

  private async leer(fn: () => Promise<CotizacionLeida>) {
    this.leyendo.set(true);
    this.error.set(null);
    try {
      await this.store.asegurar();
      const r = await fn();
      if (!r.items.length) {
        this.error.set(r.avisos[0] ?? 'No encontré productos en la cotización.');
        return;
      }
      this.aplicar(r);
      this.paso.set(2);
    } catch (e) {
      this.error.set(mensajeError(e) ?? 'No se pudo leer la cotización.');
    } finally {
      this.leyendo.set(false);
    }
  }

  /** Pasa lo leído a filas editables y empareja con el catálogo. */
  private aplicar(r: CotizacionLeida) {
    this.lectura.set(r);
    this.moneda.set(r.moneda);
    this.cotizacionRef.set(r.numero ?? '');
    this.cotizacionFecha.set(r.fecha ?? '');
    if (r.formaPago) this.condiciones.set(r.formaPago);
    const prov = r.proveedor.ruc
      ? this.store.proveedores().find((p) => p.numeroDocumento === r.proveedor.ruc)
      : undefined;
    if (prov) this.proveedorId.set(prov.id);
    else if (r.proveedor.ruc || r.proveedor.razonSocial) {
      this.proveedorId.set(NUEVO_PROVEEDOR);
      this.nuevoRuc.set(r.proveedor.ruc ?? '');
      this.nuevaRazon.set(r.proveedor.razonSocial ?? '');
    }
    this.filas.set(
      r.items.map((it) => {
        const m = emparejar(it.codigo, it.descripcion, this.store.productosActivos());
        return {
          id: ++secuencia,
          incluir: true,
          codigo: it.codigo,
          descripcion: it.descripcion,
          marca: it.marca,
          unidad: it.unidad,
          cantidad: it.cantidad,
          precio: it.precio,
          productoId: m?.producto.id ?? NUEVO,
          tipo: m?.producto.tipo ?? adivinarTipo(it.descripcion),
          emparejado: m?.por ?? 'nuevo',
        };
      }),
    );
  }

  // ---------- Paso 2: editar ----------
  protected cambiar<K extends keyof Fila>(id: number, campo: K, valor: Fila[K]) {
    this.filas.update((l) =>
      l.map((f) =>
        f.id === id
          ? {
              ...f,
              [campo]: valor,
              ...(campo === 'productoId' ? { emparejado: 'manual' as const } : {}),
            }
          : f,
      ),
    );
  }
  protected todas(v: boolean) {
    this.filas.update((l) => l.map((f) => ({ ...f, incluir: v })));
  }
  protected quitar(id: number) {
    this.filas.update((l) => l.filter((f) => f.id !== id));
  }
  protected agregarFila() {
    this.filas.update((l) => [
      ...l,
      {
        id: ++secuencia,
        incluir: true,
        codigo: '',
        descripcion: '',
        marca: '',
        unidad: 'UND',
        cantidad: 1,
        precio: 0,
        productoId: NUEVO,
        tipo: 'repuesto',
        emparejado: 'nuevo',
      },
    ]);
  }
  protected numero(v: string): number {
    const n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }

  private validar(): string | null {
    if (!this.proveedorId()) return 'Elige el proveedor (o regístralo como nuevo).';
    if (this.proveedorNuevo()) {
      if (!/^(10|15|17|20)\d{9}$/.test(this.nuevoRuc().trim()))
        return 'El RUC del proveedor nuevo debe tener 11 dígitos.';
      if (!this.nuevaRazon().trim()) return 'Escribe la razón social del proveedor nuevo.';
    }
    if (!this.almacenId()) return 'Elige a qué almacén llega.';
    const el = this.elegidas();
    if (!el.length) return 'Marca al menos un producto para comprar.';
    const mal = el.find((f) => !(f.cantidad > 0) || f.precio < 0 || !f.descripcion.trim());
    if (mal)
      return `Revisa "${mal.descripcion || mal.codigo || 'fila sin descripción'}": falta descripción, cantidad o precio.`;
    const repetido = el.find(
      (f, i) => f.productoId !== NUEVO && el.findIndex((g) => g.productoId === f.productoId) !== i,
    );
    if (repetido)
      return `"${repetido.descripcion}" está dos veces con el mismo producto del catálogo: une las cantidades.`;
    return null;
  }

  protected async aVistaPrevia() {
    const e = this.validar();
    if (e) return this.error.set(e);
    this.error.set(null);
    this.paso.set(3);
    await this.generarPdf(null, false);
  }

  // ---------- Paso 3: PDF y guardar ----------
  private datosPdf(codigo: string | null, aprobada: boolean): DatosOrdenPdf {
    const prov = this.store.proveedores().find((p) => p.id === this.proveedorId());
    const emp = this.empresa.actual();
    return {
      codigo,
      aprobada,
      fecha: hoyISO(),
      fechaEntrega: this.plazo().entregaHasta,
      moneda: this.moneda(),
      proveedor: {
        razonSocial: this.nombreProveedor(),
        ruc: this.proveedorNuevo() ? this.nuevoRuc() : (prov?.numeroDocumento ?? ''),
        direccion: this.proveedorNuevo() ? null : (prov?.direccion ?? null),
      },
      atencion: this.atencion() || null,
      condicionesPago: this.condiciones() || null,
      solicitadoPor: this.solicitado() || null,
      lugarEntrega: this.lugar() || null,
      cotizacionRef: this.cotizacionRef() || null,
      cotizacionFecha: this.cotizacionFecha() || null,
      items: this.elegidas().map((f) => ({
        codigo: f.codigo,
        descripcion: f.descripcion,
        cantidad: f.cantidad,
        unidad: f.unidad,
        precio: this.precioNeto(f),
      })),
      empresa: emp ? { razonSocial: emp.razonSocial, ruc: emp.ruc } : undefined,
    };
  }

  private async generarPdf(codigo: string | null, aprobada: boolean) {
    this.generando.set(true);
    try {
      const r = await crearPdfOrden(this.datosPdf(codigo, aprobada));
      this.pdf.set(r.bytes);
      return r;
    } catch (e) {
      this.error.set('No se pudo generar el PDF: ' + (mensajeError(e) ?? ''));
      return null;
    } finally {
      this.generando.set(false);
    }
  }

  /** Crea lo que falte, guarda la OC y descarga el PDF con su número. */
  protected async guardar(enviar: boolean) {
    const e = this.validar();
    if (e) return this.error.set(e);
    this.guardando.set(true);
    this.error.set(null);
    try {
      // 1. Proveedor nuevo
      if (this.proveedorNuevo()) {
        this.progreso.set('Registrando proveedor…');
        const p = await this.proveedoresApi.crear({
          tipoDocumento: 'RUC',
          numeroDocumento: this.nuevoRuc().trim(),
          razonSocial: this.nuevaRazon().trim(),
        });
        await this.store.recargar();
        this.proveedorId.set(p.id);
      }
      // 2. Productos nuevos (se recuerdan: si algo falla después, no se duplican)
      const nuevos = this.elegidas().filter((f) => f.productoId === NUEVO);
      for (const [i, f] of nuevos.entries()) {
        this.progreso.set(`Creando producto ${i + 1} de ${nuevos.length}…`);
        const p = await this.productosApi.crear({
          sku: skuDe(f.codigo, this.cotizacionRef(), f.id),
          nombre: f.descripcion.trim().slice(0, 160),
          tipo: f.tipo,
          marca: f.marca,
          unidad: f.unidad || 'UND',
          stockMinimo: 0,
        });
        this.cambiar(f.id, 'productoId', p.id);
      }
      if (nuevos.length) await this.store.recargar();
      // 3. La orden
      this.progreso.set('Guardando la orden…');
      const p = this.plazo();
      const oc = await this.ocApi.crear({
        proveedorId: this.proveedorId()!,
        almacenId: this.almacenId()!,
        enviar,
        moneda: this.moneda(),
        cotizacionRef: this.cotizacionRef(),
        cotizacionFecha: this.cotizacionFecha() || null,
        condicionesPago: this.condiciones(),
        atencion: this.atencion(),
        solicitadoPor: this.solicitado(),
        lugarEntrega: this.lugar(),
        plazoTexto: p.plazoTexto,
        entregaDesde: p.entregaDesde,
        entregaHasta: p.entregaHasta,
        notas: this.notas(),
        items: this.elegidas().map((f) => ({
          productoId: f.productoId,
          cantidad: f.cantidad,
          costoUnitario: this.precioNeto(f),
        })),
      });
      // 4. PDF con su número
      this.progreso.set('Generando PDF…');
      const pdf = await this.generarPdf(oc.codigo, enviar);
      pdf?.guardar();
      this.store.ok(
        `Orden ${oc.codigo} ${enviar ? 'aprobada' : 'guardada como borrador'}`,
        `${oc.items.length} productos · ${oc.proveedor.razonSocial}`,
      );
      this.guardada.emit(oc);
      this.visible.set(false);
    } catch (err) {
      this.error.set(mensajeError(err) ?? 'No se pudo guardar');
    } finally {
      this.guardando.set(false);
      this.progreso.set('');
    }
  }
}

// ---------------------------------------------------------------------
// Emparejar con el catálogo
// ---------------------------------------------------------------------
const normal = (s: string) =>
  s
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();

function palabras(s: string): Set<string> {
  return new Set(
    normal(s)
      .split(' ')
      .filter((w) => w.length > 1),
  );
}

export function emparejar(
  codigo: string,
  descripcion: string,
  productos: Producto[],
): { producto: Producto; por: 'codigo' | 'nombre' } | null {
  const c = normal(codigo).replace(/ /g, '');
  if (c) {
    const p = productos.find(
      (x) =>
        normal(x.sku).replace(/ /g, '') === c || normal(x.nombre).replace(/ /g, '').includes(c),
    );
    if (p) return { producto: p, por: 'codigo' };
  }
  const a = palabras(descripcion);
  if (!a.size) return null;
  let mejor: { producto: Producto; puntaje: number } | null = null;
  for (const p of productos) {
    const b = palabras(p.nombre);
    const comun = [...a].filter((w) => b.has(w)).length;
    const puntaje = comun / Math.max(a.size, b.size);
    if (puntaje > (mejor?.puntaje ?? 0)) mejor = { producto: p, puntaje };
  }
  return mejor && mejor.puntaje >= 0.6 ? { producto: mejor.producto, por: 'nombre' } : null;
}

export function adivinarTipo(d: string): TipoProducto {
  const t = normal(d);
  if (/\b(GAS|REFRIGERANTE|R ?22|R ?404|R ?410|R ?134|R ?507|R ?290)\b/.test(t))
    return 'gas_refrigerante';
  if (
    /\b(BOMBA DE VACIO|MANOMETRO|MANIFOLD|HERRAMIENTA|DETECTOR|ABOCARDADOR|CORTATUBO|LLAVE)\b/.test(
      t,
    )
  )
    return 'herramienta';
  if (
    /\b(ACEITE|TUBO|COBRE|ARMAFLEX|AISLANTE|SOLDADURA|VARILLA|LIMPIADOR|FOAM|KLEAN|CINTA|PEGAMENTO)\b/.test(
      t,
    )
  )
    return 'insumo';
  if (/\b(EVAPORADOR|CONDENSADORA|UNIDAD CONDENSADORA|EQUIPO|SPLIT|CHILLER)\b/.test(t))
    return 'equipo';
  return 'repuesto';
}

/** SKU válido (A-Z 0-9 . _ -) desde el código del proveedor. */
function skuDe(codigo: string, ref: string, id: number): string {
  const s = codigo
    .toUpperCase()
    .replace(/[^A-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
  if (s.length >= 2) return s;
  return `COT-${(ref || 'X').toUpperCase().replace(/[^A-Z0-9]+/g, '')}-${id}`.slice(0, 30);
}
