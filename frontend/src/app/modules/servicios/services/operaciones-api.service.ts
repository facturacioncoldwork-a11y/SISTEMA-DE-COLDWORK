import { inject, Injectable } from '@angular/core';
import { ApiService } from '../../../core/api/services/api.service';
import type { Area, Rol } from '../../../core/permisos/areas';
import type { Cotizacion } from '../models/cotizacion.model';
import type { EventoHistorial, Expediente } from '../models/expediente.model';
import type { Equipo, Mensaje, OrdenTrabajo } from '../models/servicios.model';

export interface PersonaDirectorio {
  usuarioId: string;
  nombre: string;
  rol: Rol;
  areas: Area[];
  activo: boolean;
}

export interface Guardado {
  version: number;
  numero?: string;
  codigo?: string;
}

/** Llamadas al backend de Operaciones (/api/v1/operaciones). */
@Injectable({ providedIn: 'root' })
export class OperacionesApi {
  private readonly api = inject(ApiService);

  directorio() {
    return this.api.get<PersonaDirectorio[]>('/operaciones/directorio');
  }

  // Cotizaciones
  cotizaciones() {
    return this.api.get<Cotizacion[]>('/operaciones/cotizaciones');
  }
  guardarCotizacion(id: string, datos: unknown, version: number) {
    return this.api.put<Guardado>(`/operaciones/cotizaciones/${id}`, { datos, version });
  }
  estadoCotizacion(id: string, estado: 'borrador' | 'enviada' | 'rechazada', motivo?: string) {
    return this.api.post<void>(`/operaciones/cotizaciones/${id}/estado`, { estado, motivo });
  }
  aprobarCotizacion(id: string, ordenCliente: string, expedienteId: string, expediente: unknown) {
    return this.api.post<{ expedienteId: string }>(`/operaciones/cotizaciones/${id}/aprobar`, { ordenCliente, expedienteId, expediente });
  }

  // Servicios (expedientes)
  expedientes() {
    return this.api.get<Expediente[]>('/operaciones/expedientes');
  }
  guardarExpediente(id: string, datos: unknown, version: number, nota?: string) {
    return this.api.put<Guardado>(`/operaciones/expedientes/${id}`, { datos, version, nota });
  }
  historial(id: string) {
    return this.api.get<EventoHistorial[]>(`/operaciones/expedientes/${id}/historial`);
  }

  // Equipos y órdenes
  equipos() {
    return this.api.get<Equipo[]>('/operaciones/equipos');
  }
  guardarEquipo(id: string, datos: unknown) {
    return this.api.put<void>(`/operaciones/equipos/${id}`, { datos });
  }
  ordenes() {
    return this.api.get<OrdenTrabajo[]>('/operaciones/ordenes');
  }
  guardarOrden(id: string, datos: unknown, version: number) {
    return this.api.put<Guardado>(`/operaciones/ordenes/${id}`, { datos, version });
  }
  mensajes(id: string) {
    return this.api.get<Mensaje[]>(`/operaciones/ordenes/${id}/mensajes`);
  }
  enviarMensaje(id: string, texto: string) {
    return this.api.post<Mensaje>(`/operaciones/ordenes/${id}/mensajes`, { texto });
  }
}
