import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { MessageService } from 'primeng/api';
import type { CuentaFinanciera, ResumenFinanzas, Tercero } from '../models/finanzas.model';
import { FinanzasApi } from './finanzas-api.service';

/**
 * Catálogos compartidos por todas las vistas de Finanzas (clientes/proveedores y cuentas
 * de caja y bancos) y el resumen de las tarjetas. Se cargan una vez y se refrescan
 * después de cada operación, así todas las pantallas ven los mismos saldos.
 */
@Injectable({ providedIn: 'root' })
export class FinanzasStore {
  private readonly api = inject(FinanzasApi);
  private readonly avisos = inject(MessageService);

  readonly terceros = signal<Tercero[]>([]);
  readonly cuentas = signal<CuentaFinanciera[]>([]);
  readonly resumen = signal<ResumenFinanzas | null>(null);
  readonly cargando = signal(false);
  private cargado = false;

  readonly clientes = computed(() => this.terceros().filter((t) => t.esCliente && t.activo));
  readonly proveedores = computed(() => this.terceros().filter((t) => t.esProveedor && t.activo));
  readonly cuentasActivas = computed(() => this.cuentas().filter((c) => c.activa));

  /** Carga los catálogos si aún no están. */
  async asegurar(): Promise<void> {
    if (!this.cargado) await this.recargar();
  }

  async recargar(): Promise<void> {
    this.cargando.set(true);
    // Cada parte puede fallar por permisos de área: se carga lo que se pueda
    const [terceros, cuentas, resumen] = await Promise.allSettled([
      this.api.terceros(),
      this.api.cuentas(),
      this.api.resumen(),
    ]);
    if (terceros.status === 'fulfilled') this.terceros.set(terceros.value);
    if (cuentas.status === 'fulfilled') this.cuentas.set(cuentas.value);
    if (resumen.status === 'fulfilled') this.resumen.set(resumen.value);
    if ([terceros, cuentas, resumen].every((r) => r.status === 'rejected')) {
      this.error('No se pudo cargar finanzas', (terceros as PromiseRejectedResult).reason);
    }
    this.cargado = true;
    this.cargando.set(false);
  }

  ok(resumen: string, detalle?: string) {
    this.avisos.add({ severity: 'success', summary: resumen, detail: detalle, life: 3500 });
  }

  error(resumen: string, e: unknown) {
    this.avisos.add({ severity: 'error', summary: resumen, detail: mensajeError(e), life: 6000 });
  }

  limpiar() {
    this.terceros.set([]);
    this.cuentas.set([]);
    this.resumen.set(null);
    this.cargado = false;
  }
}

export function mensajeError(e: unknown): string | undefined {
  if (e instanceof HttpErrorResponse) {
    if (e.status === 0) return 'El servidor no responde. Intenta de nuevo en unos segundos.';
    const m = (e.error as { message?: string | string[] } | null)?.message;
    return Array.isArray(m) ? m.join(' · ') : m;
  }
  return e instanceof Error ? e.message : undefined;
}
