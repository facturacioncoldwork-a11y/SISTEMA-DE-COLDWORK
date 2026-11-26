import { inject, Injectable } from '@angular/core';
import { ApiService } from '../../../core/api/services/api.service';
import type { Ausencia, Justificacion, Marca, ResultadoMarca } from '../models/personal.model';

/** Horario tal como lo envía y recibe la API. */
export interface HorarioApi {
  entrada: string;
  salida: string;
  refrigerio: number;
  refrigerioDesde: string;
  refrigerioHasta: string;
  tolerancia: number;
  metodos: string[];
  selfie: boolean;
  oficinaLat: number | null;
  oficinaLng: number | null;
  radioOficina: number;
  esGestor?: boolean;
}

/** Llamadas al backend de asistencia (/api/v1/asistencia). */
@Injectable({ providedIn: 'root' })
export class AsistenciaApi {
  private readonly api = inject(ApiService);

  horario() {
    return this.api.get<HorarioApi>('/asistencia/horario');
  }
  guardarHorario(h: Omit<HorarioApi, 'esGestor'>) {
    return this.api.put<void>('/asistencia/horario', h);
  }
  marcas(desde: string, hasta: string) {
    return this.api.get<{ marcas: Marca[]; ausencias: Ausencia[] }>(`/asistencia/marcas?desde=${desde}&hasta=${hasta}`);
  }
  marcar(datos: { metodo: 'gps' | 'codigo' | 'declarada'; lat?: number; lng?: number; codigo?: string; hora?: string; motivo?: string }) {
    return this.api.post<ResultadoMarca>('/asistencia/marcar', datos);
  }
  marcarManual(usuarioId: string, motivo: string) {
    return this.api.post<ResultadoMarca>('/asistencia/marcas/manual', { usuarioId, motivo });
  }
  aprobar(id: string) {
    return this.api.post<void>(`/asistencia/marcas/${id}/aprobar`, {});
  }
  codigoOficina() {
    return this.api.get<{ codigo: string; segundos: number }>('/asistencia/codigo-oficina');
  }
  registrarAusencia(usuarioId: string, fecha: string, tipo: Justificacion, sustento?: string) {
    return this.api.post<void>('/asistencia/ausencias', { usuarioId, fecha, tipo, sustento });
  }
}
