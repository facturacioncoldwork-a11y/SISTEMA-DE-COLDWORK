import { inject, Injectable } from '@angular/core';
import { ApiService } from '../../../core/api/services/api.service';
import type {
  AjustesLogistica,
  GuardarProducto,
  Movimiento,
  Producto,
  ResumenLogistica,
} from '../models/logistica.model';

/** /api/v1/logistica/productos · resumen · kardex */
@Injectable({ providedIn: 'root' })
export class ProductosService {
  private readonly api = inject(ApiService);

  resumen(): Promise<ResumenLogistica> {
    return this.api.get('/logistica/resumen');
  }
  listar(): Promise<Producto[]> {
    return this.api.get('/logistica/productos');
  }
  crear(datos: GuardarProducto): Promise<Producto> {
    return this.api.post('/logistica/productos', datos);
  }
  actualizar(id: string, datos: Partial<GuardarProducto>): Promise<Producto> {
    return this.api.patch(`/logistica/productos/${id}`, datos);
  }
  eliminar(id: string): Promise<void> {
    return this.api.delete(`/logistica/productos/${id}`);
  }
  kardex(id: string): Promise<Movimiento[]> {
    return this.api.get(`/logistica/productos/${id}/kardex`);
  }
  ajustes(): Promise<AjustesLogistica> {
    return this.api.get('/logistica/ajustes');
  }
  /** Solo dueño o admin. Se cambia solo lo que se envía. */
  guardarAjustes(
    datos: Partial<Pick<AjustesLogistica, 'mesesAntiguedad' | 'tipoCambioRef'>>,
  ): Promise<AjustesLogistica> {
    return this.api.put('/logistica/ajustes', datos);
  }
  /** Solo el dueño: convierte los costos ya registrados con el tipo de cambio (S/ por US$). */
  cambiarMoneda(moneda: 'PEN' | 'USD', tipoCambio?: number): Promise<AjustesLogistica> {
    return this.api.post('/logistica/ajustes/moneda', { moneda, tipoCambio });
  }
}
