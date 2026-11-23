import { inject, Injectable } from '@angular/core';
import { ApiService } from '../../../core/api/services/api.service';
import type {
  ActualizarOrdenCompra,
  CrearOrdenCompra,
  OrdenCompra,
} from '../models/logistica.model';

/** /api/v1/logistica/ordenes-compra */
@Injectable({ providedIn: 'root' })
export class OrdenesCompraService {
  private readonly api = inject(ApiService);

  listar(): Promise<OrdenCompra[]> {
    return this.api.get('/logistica/ordenes-compra');
  }
  crear(datos: CrearOrdenCompra): Promise<OrdenCompra> {
    return this.api.post('/logistica/ordenes-compra', datos);
  }
  actualizar(id: string, datos: ActualizarOrdenCompra): Promise<OrdenCompra> {
    return this.api.patch(`/logistica/ordenes-compra/${id}`, datos);
  }
  eliminar(id: string): Promise<void> {
    return this.api.delete(`/logistica/ordenes-compra/${id}`);
  }
  enviar(id: string): Promise<OrdenCompra> {
    return this.api.post(`/logistica/ordenes-compra/${id}/enviar`, {});
  }
  anular(id: string): Promise<OrdenCompra> {
    return this.api.post(`/logistica/ordenes-compra/${id}/anular`, {});
  }
}
