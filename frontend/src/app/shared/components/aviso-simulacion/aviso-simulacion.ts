import { Component, input } from '@angular/core';

/** Franja que avisa que la pantalla es una SIMULACIÓN (datos de ejemplo, nada se guarda). */
@Component({
  selector: 'app-aviso-simulacion',
  template: `
    <div class="aviso no-imprimir" role="note">
      <i class="pi pi-eye"></i>
      <span><strong>Simulación:</strong> {{ texto() }}</span>
    </div>
  `,
  styles: `
    .aviso { display: flex; gap: 0.6rem; align-items: center; margin-bottom: 1rem; padding: 0.6rem 0.9rem;
      border-radius: 0.75rem; border: 1px dashed #f59e0b; background: #fffbeb; color: #92400e; font-size: 0.86rem; }
  `,
})
export class AvisoSimulacion {
  readonly texto = input('datos de ejemplo para revisar el diseño. Nada se guarda en la base de datos.');
}
