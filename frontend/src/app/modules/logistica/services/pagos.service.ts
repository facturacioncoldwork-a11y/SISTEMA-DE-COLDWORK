import { computed, inject, Injectable, signal } from '@angular/core';
import { ApiService } from '../../../core/api/services/api.service';
import { hoyISO } from '../models/plazos';
import type { GuardarPago, OrdenConPagos, Pago } from '../models/logistica.model';
import { estadoCuota } from '../models/pagos';

/**
 * /api/v1/logistica/pagos — plan de pagos de cada OC (solo el CEO).
 * Guarda la lista para que la pestaña muestre el aviso de vencidos sin volver a pedirla.
 */
@Injectable({ providedIn: 'root' })
export class PagosService {
  private readonly api = inject(ApiService);

  readonly ordenes = signal<OrdenConPagos[]>([]);
  readonly cargando = signal(false);
  readonly cargado = signal(false);

  /** Cuotas vencidas o que vencen hoy (para el número rojo de la pestaña). */
  readonly urgentes = computed(() => {
    const hoy = hoyISO();
    return this.ordenes()
      .flatMap((o) => o.pagos)
      .filter((p) => {
        const e = estadoCuota(p, hoy);
        return e === 'vencido' || e === 'hoy';
      }).length;
  });

  async recargar(): Promise<void> {
    this.cargando.set(true);
    try {
      this.ordenes.set(await this.api.get<OrdenConPagos[]>('/logistica/pagos'));
      this.cargado.set(true);
    } finally {
      this.cargando.set(false);
    }
  }

  crear(datos: GuardarPago): Promise<Pago> {
    return this.api.post('/logistica/pagos', datos);
  }
  actualizar(id: string, datos: Partial<Omit<GuardarPago, 'ordenId'>>): Promise<Pago> {
    return this.api.patch(`/logistica/pagos/${id}`, datos);
  }
  pagar(id: string, pagadoEn: string, referencia?: string): Promise<Pago> {
    return this.api.post(`/logistica/pagos/${id}/pagar`, { pagadoEn, referencia });
  }
  deshacer(id: string): Promise<Pago> {
    return this.api.post(`/logistica/pagos/${id}/deshacer`, {});
  }
  eliminar(id: string): Promise<void> {
    return this.api.delete(`/logistica/pagos/${id}`);
  }
}
