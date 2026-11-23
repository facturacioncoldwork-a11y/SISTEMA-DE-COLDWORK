import { Component, input, signal } from '@angular/core';

/**
 * Logo oficial de COLD WORK (public/documentos/logo-coldwork.png).
 * Va sobre una "pastilla" blanca para que se lea igual sobre fondos oscuros.
 * El mismo archivo lo usa el PDF de la orden de compra.
 */
@Component({
  selector: 'app-logo',
  template: `
    <span class="pastilla" [class.plano]="plano()" [style.height]="alto()">
      @if (!falla()) {
        <img
          src="documentos/logo-coldwork.png"
          alt="COLD WORK Refrigeración Industrial"
          (error)="falla.set(true)"
          draggable="false"
        />
      } @else {
        <b>COLD WORK</b>
      }
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
    }
    .pastilla {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: #fff;
      border-radius: 0.8rem;
      padding: 0.35rem 0.7rem;
      box-shadow: 0 6px 18px -8px rgb(0 0 0 / 0.45);
    }
    .pastilla.plano {
      background: transparent;
      box-shadow: none;
      padding: 0;
    }
    img {
      height: 100%;
      width: auto;
      display: block;
    }
    b {
      color: #0a4a9c;
      letter-spacing: 0.06em;
      font-size: 1.1rem;
    }
  `,
})
export class Logo {
  /** Alto total, ej. '2.6rem'. */
  readonly alto = input('2.6rem');
  /** Sin fondo blanco (para fondos claros). */
  readonly plano = input(false);
  protected readonly falla = signal(false);
}
