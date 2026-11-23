import { inject, Injectable } from '@angular/core';
import { ApiService } from '../../../core/api/services/api.service';
import type {
  ActualizarLlegada,
  ActualizarSalida,
  CrearLlegada,
  CrearSalida,
  Llegada,
  Salida,
} from '../models/logistica.model';

/** /api/v1/logistica/llegadas · /salidas */
@Injectable({ providedIn: 'root' })
export class MovimientosService {
  private readonly api = inject(ApiService);

  llegadas(): Promise<Llegada[]> {
    return this.api.get('/logistica/llegadas');
  }
  registrarLlegada(datos: CrearLlegada): Promise<Llegada> {
    return this.api.post('/logistica/llegadas', datos);
  }
  actualizarLlegada(id: string, datos: ActualizarLlegada): Promise<Llegada> {
    return this.api.patch(`/logistica/llegadas/${id}`, datos);
  }
  /** Borra de la BD y revierte stock, kardex y avance de la OC. */
  eliminarLlegada(id: string): Promise<void> {
    return this.api.delete(`/logistica/llegadas/${id}`);
  }
  salidas(): Promise<Salida[]> {
    return this.api.get('/logistica/salidas');
  }
  actualizarSalida(id: string, datos: ActualizarSalida): Promise<Salida> {
    return this.api.patch(`/logistica/salidas/${id}`, datos);
  }
  /** Borra de la BD y devuelve el stock. */
  eliminarSalida(id: string): Promise<void> {
    return this.api.delete(`/logistica/salidas/${id}`);
  }
  registrarSalida(datos: CrearSalida): Promise<Salida> {
    return this.api.post('/logistica/salidas', datos);
  }
}
