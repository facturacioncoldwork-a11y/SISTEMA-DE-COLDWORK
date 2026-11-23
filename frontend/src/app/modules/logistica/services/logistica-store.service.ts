import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import type { Almacen, Producto, Proveedor } from '../models/logistica.model';
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
  private cargado = false;

  readonly productosActivos = computed(() => this.productos().filter((p) => p.activo));
  readonly almacenesActivos = computed(() => this.almacenes().filter((a) => a.activo));
  readonly proveedoresActivos = computed(() => this.proveedores().filter((p) => p.activo));
  readonly almacenPorId = computed(() => new Map(this.almacenes().map((a) => [a.id, a])));
  readonly productoPorId = computed(() => new Map(this.productos().map((p) => [p.id, p])));

  /** Carga los catálogos si aún no están. */
  async asegurar(): Promise<void> {
    if (!this.cargado) await this.recargar();
  }

  async recargar(): Promise<void> {
    this.cargando.set(true);
    try {
      const [p, a, v] = await Promise.all([
        this.productosApi.listar(),
        this.almacenesApi.listar(),
        this.proveedoresApi.listar(),
      ]);
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

export function mensajeError(e: unknown): string | undefined {
  if (e instanceof HttpErrorResponse) {
    if (e.status === 0) return 'La API no responde. Revisa que el backend esté encendido.';
    const m = (e.error as { message?: string | string[] } | null)?.message;
    return Array.isArray(m) ? m.join(' · ') : m;
  }
  return e instanceof Error ? e.message : undefined;
}
