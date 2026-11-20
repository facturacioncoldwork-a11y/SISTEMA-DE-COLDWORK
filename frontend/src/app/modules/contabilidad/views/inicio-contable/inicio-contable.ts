import { Component, inject } from '@angular/core';
import { ContabilidadService } from '../../services/contabilidad.service';
import { MiTrabajo } from '../mi-trabajo/mi-trabajo';
import { Resumen } from '../resumen/resumen';

/** Primera pestaña del módulo: el dueño ve el Resumen; el contador, su trabajo pendiente. */
@Component({
  selector: 'app-inicio-contable',
  imports: [MiTrabajo, Resumen],
  template: `
    @if (conta.permisos().aprobar) {
      <app-resumen />
    } @else {
      <app-mi-trabajo />
    }
  `,
})
export class InicioContable {
  protected readonly conta = inject(ContabilidadService);
}
