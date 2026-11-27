import { computed, inject, Injectable, signal } from '@angular/core';
import { mensajeError } from '../../../core/api/errores';
import { MessageService } from 'primeng/api';
import {
  antiguedadDe,
  MESES_ANTIGUEDAD_POR_DEFECTO,
  textoAntiguedad,
  type Antiguedad,
} from '../models/antiguedad';
import type {
  AjustesLogistica,
  Almacen,
  Moneda,
  Producto,
  Proveedor,
} from '../models/logistica.model';
import { AlmacenesService } from './almacenes.service';
import { ProductosService } from './productos.service';
import { ProveedoresService } from './proveedores.service';

/**
 * Catálogos compartidos por todas las vistas de logística (productos,
 * almacenes y proveedores). Se cargan una vez y se refrescan después de
 * cada operación, así todas las pantallas ven el mismo stock.
 */
@Injectable({ providedIn: 'root' })
export class LogisticaStore {
  private readonly productosApi = inject(ProductosService);
  private readonly almacenesApi = inject(AlmacenesService);
  private readonly proveedoresApi = inject(ProveedoresService);
  private readonly avisos = inject(MessageService);

  readonly productos = signal<Producto[]>([]);
  readonly almacenes = signal<Almacen[]>([]);
  readonly proveedores = signal<Proveedor[]>([]);
  readonly cargando = signal(false);
  /** Meses desde los que un producto es antiguo (ajuste de la empresa). */
  readonly mesesAntiguedad = signal(MESES_ANTIGUEDAD_POR_DEFECTO);
  /** Moneda en que se lleva el inventario (soles hasta que el dueño elija dólares). */
  readonly moneda = signal<Moneda>('PEN');
  /** S/ por US$ que se propone en compras de otra moneda. */
  readonly tipoCambioRef = signal<number | null>(null);
  private cargado = false;

  readonly productosActivos = computed(() => this.productos().filter((p) => p.activo));
  readonly almacenesActivos = computed(() => this.almacenes().filter((a) => a.activo));
  readonly proveedoresActivos = computed(() => this.proveedores().filter((p) => p.activo));
  readonly almacenPorId = computed(() => new Map(this.almacenes().map((a) => [a.id, a])));
  readonly productoPorId = computed(() => new Map(this.productos().map((p) => [p.id, p])));

  /** Cuánto tiempo lleva cada producto en el almacén. */
  readonly antiguedad = computed(() => {
    const limite = this.mesesAntiguedad();
    const hoy = new Date();
    return new Map<string, Antiguedad>(
      this.productos().map((p) => [p.id, antiguedadDe(p.lotes ?? [], limite, hoy)]),
    );
  });
  /** Productos activos que pasaron el límite: venderlos pronto, aunque sea con descuento. */
  readonly antiguos = computed(() => {
    const a = this.antiguedad();
    return this.productosActivos()
      .map((p) => ({ producto: p, antiguedad: a.get(p.id)! }))
      .filter((x) => x.antiguedad.nivel === 'antiguo')
      .sort((x, y) => y.antiguedad.meses - x.antiguedad.meses);
  });

  /** Carga los catálogos si aún no están. */
  async asegurar(): Promise<void> {
    if (!this.cargado) await this.recargar();
  }

  async recargar(): Promise<void> {
    this.cargando.set(true);
    try {
      const [p, a, v, aj] = await Promise.all([
        this.productosApi.listar(),
        this.almacenesApi.listar(),
        this.proveedoresApi.listar(),
        // Si falla (p. ej. falta la migración), se sigue con el límite por defecto
        this.productosApi.ajustes().catch(() => null),
      ]);
      if (aj) this.aplicarAjustes(aj);
      this.productos.set(p);
      this.almacenes.set(a);
      this.proveedores.set(v);
      this.cargado = true;
    } catch (e) {
      this.error('No se pudo cargar logística', e);
    } finally {
      this.cargando.set(false);
    }
  }

  private aplicarAjustes(aj: AjustesLogistica) {
    this.mesesAntiguedad.set(aj.mesesAntiguedad);
    this.moneda.set(aj.moneda ?? 'PEN');
    this.tipoCambioRef.set(aj.tipoCambioRef ?? null);
  }

  /** Tipo de cambio referencial para compras en otra moneda (solo dueño o admin). */
  async guardarTipoCambioRef(tc: number | null): Promise<boolean> {
    try {
      this.aplicarAjustes(await this.productosApi.guardarAjustes({ tipoCambioRef: tc }));
      this.ok(
        'Tipo de cambio guardado',
        tc ? `S/ ${tc} por US$` : 'Sin tipo de cambio referencial',
      );
      return true;
    } catch (e) {
      this.error('No se pudo guardar el tipo de cambio', e);
      return false;
    }
  }

  /** Lleva el inventario en otra moneda convirtiendo los costos ya registrados (solo el dueño). */
  async cambiarMoneda(moneda: Moneda, tipoCambio?: number): Promise<boolean> {
    try {
      this.aplicarAjustes(await this.productosApi.cambiarMoneda(moneda, tipoCambio));
      await this.recargar();
      this.ok(
        'Moneda del inventario cambiada',
        moneda === 'USD'
          ? 'Ahora todo se lleva en dólares (US$)'
          : 'Ahora todo se lleva en soles (S/)',
      );
      return true;
    } catch (e) {
      this.error('No se pudo cambiar la moneda', e);
      return false;
    }
  }

  /** Cambia desde cuántos meses un producto es antiguo (solo dueño o admin). */
  async guardarMesesAntiguedad(meses: number): Promise<boolean> {
    try {
      const r = await this.productosApi.guardarAjustes({ mesesAntiguedad: meses });
      this.aplicarAjustes(r);
      this.ok('Límite guardado', `Antiguo desde ${r.mesesAntiguedad} meses en almacén`);
      return true;
    } catch (e) {
      this.error('No se pudo guardar el límite', e);
      return false;
    }
  }

  /**
   * Aviso para no comprar de más: "Ya tienes 5 UND en almacén".
   * Si lo que hay se está poniendo viejo, pide usarlo antes de comprar. null si no hay stock.
   */
  yaTienes(productoId: string | null | undefined): { texto: string; antiguo: boolean } | null {
    const p = productoId ? this.productoPorId().get(productoId) : undefined;
    if (!p || p.stockTotal <= 0) return null;
    const a = this.antiguedad().get(p.id);
    const n = Math.round(p.stockTotal * 1000) / 1000;
    let texto = `Ya tienes ${n} ${p.unidad} en almacén`;
    if (a?.desde && a.nivel !== 'reciente') {
      texto += ` (desde hace ${textoAntiguedad(a.desde)}): úsalo antes de comprar`;
    }
    return { texto, antiguo: a?.nivel === 'antiguo' };
  }

  /** Stock de un producto en un almacén. */
  stockEn(productoId: string, almacenId: string): number {
    return (
      this.productoPorId()
        .get(productoId)
        ?.stock.find((s) => s.almacenId === almacenId)?.cantidad ?? 0
    );
  }

  ok(resumen: string, detalle?: string) {
    this.avisos.add({ severity: 'success', summary: resumen, detail: detalle, life: 3500 });
  }

  error(resumen: string, e: unknown) {
    this.avisos.add({ severity: 'error', summary: resumen, detail: mensajeError(e), life: 6000 });
  }

  limpiar() {
    this.productos.set([]);
    this.almacenes.set([]);
    this.proveedores.set([]);
    this.cargado = false;
  }
}

/** Una sola versión para toda la app (core/api/errores). */
export { mensajeError };
