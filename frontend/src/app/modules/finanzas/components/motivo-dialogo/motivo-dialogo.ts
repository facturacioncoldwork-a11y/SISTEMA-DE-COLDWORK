import { Component, effect, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { TextareaModule } from 'primeng/textarea';

/**
 * Pide el motivo antes de anular un documento o movimiento.
 * Anular no borra: queda en los libros como anulado (exigencia de SUNAT).
 */
@Component({
  selector: 'app-motivo-dialogo',
  imports: [FormsModule, DialogModule, TextareaModule],
  template: `
    <p-dialog [(visible)]="visible" [modal]="true" [draggable]="false" [style]="{ width: 'min(30rem, 94vw)' }" [header]="titulo()">
      <form class="lg-form" (ngSubmit)="enviar()">
        <p class="full texto">{{ detalle() }}</p>
        <div class="full">
          <label for="motivo">Motivo</label>
          <textarea pTextarea id="motivo" name="motivo" rows="3" [(ngModel)]="motivo" placeholder="Ej. Error en el importe"></textarea>
        </div>
        @if (error(); as e) {
          <p class="error"><i class="pi pi-exclamation-circle"></i> {{ e }}</p>
        }
        <div class="full lg-pie-dialogo">
          <button type="button" class="lg-cta lg-cta--suave" (click)="visible.set(false)">Cancelar</button>
          <button type="submit" class="lg-cta lg-peligro" [disabled]="ocupado()">
            <i [class]="ocupado() ? 'pi pi-spin pi-spinner' : 'pi pi-ban'"></i> Anular
          </button>
        </div>
      </form>
    </p-dialog>
  `,
  styles: `
    .texto { margin: 0; color: var(--lg-muted); font-size: 0.9rem; }
    textarea { width: 100%; }
  `,
})
export class MotivoDialogo {
  readonly visible = model(false);
  readonly titulo = input('Anular');
  readonly detalle = input('Quedará en los libros como anulado.');
  readonly ocupado = input(false);
  readonly error = input<string | null>(null);
  readonly confirmar = output<string>();

  protected motivo = '';

  constructor() {
    effect(() => {
      if (this.visible()) this.motivo = '';
    });
  }

  protected enviar() {
    if (!this.motivo.trim()) return;
    this.confirmar.emit(this.motivo.trim());
  }
}
