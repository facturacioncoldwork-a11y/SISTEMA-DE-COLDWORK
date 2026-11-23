import { inject, Injectable } from '@angular/core';
import { ApiService } from '../../../core/api/services/api.service';
import type { GuardarProveedor, Proveedor } from '../models/logistica.model';

/** /api/v1/logistica/proveedores */
@Injectable({ providedIn: 'root' })
export class ProveedoresService {
  private readonly api = inject(ApiService);

  listar(): Promise<Proveedor[]> {
    return this.api.get('/logistica/proveedores');
  }
  crear(datos: GuardarProveedor): Promise<Proveedor> {
    return this.api.post('/logistica/proveedores', datos);
  }
  eliminar(id: string): Promise<void> {
    return this.api.delete(`/logistica/proveedores/${id}`);
  }
  actualizar(id: string, datos: Partial<GuardarProveedor>): Promise<Proveedor> {
    return this.api.patch(`/logistica/proveedores/${id}`, datos);
  }
}
