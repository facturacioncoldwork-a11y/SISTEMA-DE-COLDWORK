import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FinanzasStore } from '../../services/finanzas-store.service';
import { dinero } from '../../utils/calculos';

/** Panel de finanzas: dinero disponible, por cobrar, por pagar y movimiento del mes. */
@Component({
  selector: 'app-panel-finanzas',
  imports: [RouterLink],
  templateUrl: './panel.html',
  styleUrl: './panel.scss',
})
export class PanelFinanzas implements OnInit {
  protected readonly store = inject(FinanzasStore);
  protected readonly dinero = dinero;

  ngOnInit() {
    void this.store.recargar();
  }
}
