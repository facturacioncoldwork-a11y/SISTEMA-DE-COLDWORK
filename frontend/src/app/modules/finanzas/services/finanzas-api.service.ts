import { inject, Injectable } from '@angular/core';
import { ApiService } from '../../../core/api/services/api.service';
import type {
  Comprobante,
  CuentaFinanciera,
  GuardarCuenta,
  GuardarTercero,
  Movimiento,
  NuevoComprobante,
  NuevoMovimiento,
  Operacion,
  Pendiente,
  ResumenFinanzas,
  SaldoContable,
  Tercero,
} from '../models/finanzas.model';

/** Llamadas al backend del módulo Finanzas (/api/v1/finanzas). */
@Injectable({ providedIn: 'root' })
export class FinanzasApi {
  private readonly api = inject(ApiService);

  resumen() {
    return this.api.get<ResumenFinanzas>('/finanzas/resumen');
  }

  // ─── Clientes y proveedores ──────────────────────────────────
  terceros() {
    return this.api.get<Tercero[]>('/finanzas/terceros');
  }
  crearTercero(datos: GuardarTercero) {
    return this.api.post<{ id: string }>('/finanzas/terceros', datos);
  }
  actualizarTercero(id: string, datos: GuardarTercero) {
    return this.api.patch<void>(`/finanzas/terceros/${id}`, datos);
  }
  eliminarTercero(id: string) {
    return this.api.delete<void>(`/finanzas/terceros/${id}`);
  }

  // ─── Comprobantes ────────────────────────────────────────────
  comprobantes(operacion: Operacion, desde: string, hasta: string) {
    return this.api.get<Comprobante[]>(`/finanzas/comprobantes?operacion=${operacion}&desde=${desde}&hasta=${hasta}`);
  }
  pendientes(operacion: Operacion) {
    return this.api.get<Pendiente[]>(`/finanzas/pendientes?operacion=${operacion}`);
  }
  registrarComprobante(datos: NuevoComprobante) {
    return this.api.post<{ id: string }>('/finanzas/comprobantes', datos);
  }
  anularComprobante(id: string, motivo: string) {
    return this.api.post<void>(`/finanzas/comprobantes/${id}/anular`, { motivo });
  }

  // ─── Caja y bancos ───────────────────────────────────────────
  cuentas() {
    return this.api.get<CuentaFinanciera[]>('/finanzas/cuentas');
  }
  crearCuenta(datos: GuardarCuenta) {
    return this.api.post<{ id: string }>('/finanzas/cuentas', datos);
  }
  actualizarCuenta(id: string, datos: GuardarCuenta) {
    return this.api.patch<{ id: string }>(`/finanzas/cuentas/${id}`, datos);
  }
  movimientos(filtro: { cuenta?: string; desde?: string; hasta?: string }) {
    const q = new URLSearchParams(Object.entries(filtro).filter(([, v]) => !!v) as [string, string][]);
    return this.api.get<Movimiento[]>(`/finanzas/movimientos?${q.toString()}`);
  }
  registrarMovimiento(datos: NuevoMovimiento) {
    return this.api.post<{ id: string }>('/finanzas/movimientos', datos);
  }
  anularMovimiento(id: string, motivo: string) {
    return this.api.post<void>(`/finanzas/movimientos/${id}/anular`, { motivo });
  }

  // ─── Reportes ────────────────────────────────────────────────
  saldosContables(hasta: string, desde?: string) {
    return this.api.get<SaldoContable[]>(
      `/finanzas/saldos-contables?hasta=${hasta}${desde ? `&desde=${desde}` : ''}`,
    );
  }
}
