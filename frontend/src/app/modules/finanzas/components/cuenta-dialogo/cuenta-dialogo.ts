import { Component, effect, inject, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TIPOS_CUENTA } from '../../data/finanzas';
import type { CuentaFinanciera, GuardarCuenta, Moneda, TipoCuenta } from '../../models/finanzas.model';
import { FinanzasApi } from '../../services/finanzas-api.service';
import { mensajeError } from '../../services/finanzas-store.service';

/** Crear o editar una cuenta de caja o banco. */
@Component({
  selector: 'app-cuenta-dialogo',
  imports: [FormsModule, CheckboxModule, DialogModule, InputTextModule, SelectButtonModule],
  template: `
    <p-dialog
      [(visible)]="visible"
      [modal]="true"
      [draggable]="false"
      [style]="{ width: 'min(36rem, 96vw)' }"
      [header]="cuenta() ? 'Editar cuenta' : 'Nueva cuenta de caja o banco'"
    >
      <form class="lg-form" (ngSubmit)="guardar()">
        @if (!cuenta()) {
          <div class="full tipos">
            @for (t of tipos; track t.valor) {
              <button type="button" class="tipo" [class.on]="tipo() === t.valor" (click)="tipo.set(t.valor)">
                <i [class]="t.icono"></i>
                <span>{{ t.nombre }}</span>
                <small>Cuenta {{ t.cuenta }}</small>
              </button>
            }
          </div>
        }
        <div class="full">
          <label for="cu-nom">Nombre</label>
          <input pInputText id="cu-nom" name="nom" [placeholder]="ejemplo()" [(ngModel)]="nombre" />
        </div>
        @if (tipo() !== 'caja') {
          <div>
            <label for="cu-banco">Banco</label>
            <input pInputText id="cu-banco" name="banco" [placeholder]="tipo() === 'detracciones' ? 'Banco de la Nación' : 'BCP, Interbank, BBVA…'" [(ngModel)]="banco" />
          </div>
          <div>
            <label for="cu-num">N.° de cuenta</label>
            <input pInputText id="cu-num" name="num" [(ngModel)]="numero" />
          </div>
        }
        @if (!cuenta() && tipo() !== 'detracciones') {
          <div>
            <span class="lbl">Moneda</span>
            <p-selectbutton
              name="mon"
              [options]="monedas"
              optionLabel="etiqueta"
              optionValue="valor"
              [allowEmpty]="false"
              [ngModel]="moneda()"
              (ngModelChange)="moneda.set($event)"
            />
          </div>
        }
        @if (cuenta()) {
          <label class="full chk" for="cu-act"><p-checkbox inputId="cu-act" name="act" [binary]="true" [(ngModel)]="activa" /> Activa</label>
        }
        @if (tipo() === 'detracciones') {
          <p class="full aviso"><i class="pi pi-lock"></i> El dinero de detracciones solo sirve para pagar tributos (IGV, renta, ESSALUD). Se libera con autorización de SUNAT.</p>
        }
        <p class="full ayuda">Para el saldo inicial, registra un "Otro ingreso" con contrapartida 5011 (aporte de capital) o la que indique tu contador.</p>
        @if (error(); as e) {
          <p class="error"><i class="pi pi-exclamation-circle"></i> {{ e }}</p>
        }
        <div class="full lg-pie-dialogo">
          <button type="button" class="lg-cta lg-cta--suave" (click)="visible.set(false)">Cancelar</button>
          <button type="submit" class="lg-cta" [disabled]="guardando()"><i class="pi pi-check"></i> Guardar</button>
        </div>
      </form>
    </p-dialog>
  `,
  styles: `
    .tipos { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.6rem; }
    .tipo { display: flex; flex-direction: column; align-items: center; gap: 0.3rem; padding: 0.8rem 0.5rem;
      border: 1.5px solid var(--lg-line); border-radius: 0.9rem; background: #fff; cursor: pointer; font: inherit; text-align: center; }
    .tipo i { font-size: 1.3rem; color: var(--lg-blue); }
    .tipo span { font-weight: 650; font-size: 0.85rem; }
    .tipo small { color: var(--lg-muted); font-size: 0.72rem; }
    .tipo.on { border-color: var(--lg-blue); background: #eff6ff; }
    .chk { display: flex; gap: 0.5rem; align-items: center; }
    .aviso { margin: 0; padding: 0.55rem 0.75rem; border-radius: 0.6rem; background: #fff7e6; color: #7a4b00; font-size: 0.84rem; }
    .ayuda { margin: 0; font-size: 0.8rem; color: var(--lg-muted); }
  `,
})
export class CuentaDialogo {
  private readonly api = inject(FinanzasApi);

  readonly visible = model(false);
  readonly cuenta = input<CuentaFinanciera | null>(null);
  readonly guardado = output<void>();

  protected readonly tipos = TIPOS_CUENTA;
  protected readonly monedas = [
    { etiqueta: 'Soles', valor: 'PEN' },
    { etiqueta: 'Dólares', valor: 'USD' },
  ];
  protected readonly tipo = signal<TipoCuenta>('banco');
  protected readonly moneda = signal<Moneda>('PEN');
  protected nombre = '';
  protected banco = '';
  protected numero = '';
  protected activa = true;
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      if (!this.visible()) return;
      const c = this.cuenta();
      this.tipo.set(c?.tipo ?? 'banco');
      this.moneda.set(c?.moneda ?? 'PEN');
      this.nombre = c?.nombre ?? '';
      this.banco = c?.banco ?? '';
      this.numero = c?.numero ?? '';
      this.activa = c?.activa ?? true;
      this.error.set(null);
    });
  }

  protected ejemplo(): string {
    return this.tipo() === 'caja' ? 'Caja chica oficina' : this.tipo() === 'detracciones' ? 'Detracciones BN' : 'BCP Soles';
  }

  protected async guardar() {
    if (this.nombre.trim().length < 2) return this.error.set('Escribe un nombre para la cuenta.');
    const tipo = this.tipo();
    const datos: GuardarCuenta = {
      nombre: this.nombre.trim(),
      tipo,
      banco: tipo === 'detracciones' ? this.banco.trim() || 'Banco de la Nación' : this.banco.trim() || undefined,
      numero: this.numero.trim() || undefined,
      moneda: tipo === 'detracciones' ? 'PEN' : this.moneda(),
      cuentaContable: TIPOS_CUENTA.find((t) => t.valor === tipo)!.cuenta,
      activa: this.activa,
    };
    this.guardando.set(true);
    this.error.set(null);
    try {
      const c = this.cuenta();
      if (c) await this.api.actualizarCuenta(c.id, datos);
      else await this.api.crearCuenta(datos);
      this.guardado.emit();
      this.visible.set(false);
    } catch (e) {
      this.error.set(mensajeError(e) ?? 'No se pudo guardar.');
    } finally {
      this.guardando.set(false);
    }
  }
}
