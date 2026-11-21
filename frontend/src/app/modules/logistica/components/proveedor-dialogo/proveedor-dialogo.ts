import { Component, effect, inject, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectButtonModule } from 'primeng/selectbutton';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import type { Proveedor } from '../../models/logistica.model';
import { usarConfirmacion } from '../../services/confirmar';
import { LogisticaStore, mensajeError } from '../../services/logistica-store.service';
import { ProveedoresService } from '../../services/proveedores.service';

type TipoDoc = Proveedor['tipoDocumento'];

/** Crear o editar un proveedor. */
@Component({
  selector: 'app-proveedor-dialogo',
  imports: [
    FormsModule,
    DialogModule,
    InputTextModule,
    InputNumberModule,
    SelectButtonModule,
    ToggleSwitchModule,
  ],
  template: `
    <p-dialog
      [(visible)]="visible"
      [modal]="true"
      [draggable]="false"
      [style]="{ width: 'min(40rem, 96vw)' }"
      [header]="proveedor() ? 'Editar proveedor' : 'Nuevo proveedor'"
    >
      <form class="lg-form" (ngSubmit)="guardar()">
        <div>
          <span class="lbl">Documento</span>
          <p-selectbutton
            name="tdoc"
            [options]="tiposDoc"
            [allowEmpty]="false"
            [ngModel]="tipoDocumento()"
            (ngModelChange)="tipoDocumento.set($event)"
          />
        </div>
        <div>
          <label for="v-doc">Número</label>
          <input
            pInputText
            id="v-doc"
            name="doc"
            [placeholder]="tipoDocumento() === 'RUC' ? '20xxxxxxxxx' : ''"
            [ngModel]="numeroDocumento()"
            (ngModelChange)="numeroDocumento.set($event)"
          />
        </div>
        <div class="full">
          <label for="v-rs">Razón social</label>
          <input
            pInputText
            id="v-rs"
            name="rs"
            placeholder="Refrigeración Andina S.A.C."
            [ngModel]="razonSocial()"
            (ngModelChange)="razonSocial.set($event)"
          />
        </div>
        <div>
          <label for="v-rubro">Rubro</label>
          <input
            pInputText
            id="v-rubro"
            name="rubro"
            placeholder="Gases, compresores, cobre…"
            [ngModel]="rubro()"
            (ngModelChange)="rubro.set($event)"
          />
        </div>
        <div>
          <label for="v-cred">Días de crédito</label>
          <p-inputnumber
            inputId="v-cred"
            name="cred"
            [min]="0"
            [max]="365"
            suffix=" días"
            [ngModel]="diasCredito()"
            (ngModelChange)="diasCredito.set($event)"
          />
        </div>
        <div>
          <label for="v-cont">Contacto</label>
          <input
            pInputText
            id="v-cont"
            name="cont"
            placeholder="Nombre del vendedor"
            [ngModel]="contacto()"
            (ngModelChange)="contacto.set($event)"
          />
        </div>
        <div>
          <label for="v-tel">Teléfono / WhatsApp</label>
          <input
            pInputText
            id="v-tel"
            name="tel"
            placeholder="+51 9xx xxx xxx"
            [ngModel]="telefono()"
            (ngModelChange)="telefono.set($event)"
          />
        </div>
        <div>
          <label for="v-mail">Correo</label>
          <input
            pInputText
            id="v-mail"
            name="mail"
            type="email"
            placeholder="ventas@proveedor.pe"
            [ngModel]="correo()"
            (ngModelChange)="correo.set($event)"
          />
        </div>
        <div>
          <span class="lbl">Calificación</span>
          <div class="estrellas" role="radiogroup" aria-label="Calificación">
            @for (n of [1, 2, 3, 4, 5]; track n) {
              <button
                type="button"
                [attr.aria-label]="n + ' estrellas'"
                (click)="calificacion.set(calificacion() === n ? null : n)"
              >
                <i [class]="(calificacion() ?? 0) >= n ? 'pi pi-star-fill' : 'pi pi-star'"></i>
              </button>
            }
          </div>
        </div>
        <div class="full">
          <label for="v-dir">Dirección</label>
          <input
            pInputText
            id="v-dir"
            name="dir"
            [ngModel]="direccion()"
            (ngModelChange)="direccion.set($event)"
          />
        </div>
        @if (proveedor()) {
          <div class="full" style="display: flex; gap: 0.6rem; align-items: center">
            <p-toggleswitch
              inputId="v-act"
              name="act"
              [ngModel]="activo()"
              (ngModelChange)="activo.set($event)"
            />
            <label for="v-act" style="margin: 0">Proveedor activo</label>
          </div>
        }
        @if (error(); as e) {
          <p class="error"><i class="pi pi-exclamation-circle"></i> {{ e }}</p>
        }
        <div class="full lg-pie-dialogo">
          @if (proveedor()) {
            <button
              type="button"
              class="lg-cta lg-cta--suave lg-peligro"
              style="margin-right: auto"
              [disabled]="guardando()"
              (click)="eliminar()"
            >
              <i class="pi pi-trash"></i> Eliminar
            </button>
          }
          <button type="button" class="lg-cta lg-cta--suave" (click)="visible.set(false)">
            Cancelar
          </button>
          <button type="submit" class="lg-cta" [disabled]="guardando()">
            <i [class]="guardando() ? 'pi pi-spin pi-spinner' : 'pi pi-check'"></i> Guardar
          </button>
        </div>
      </form>
    </p-dialog>
  `,
  styles: `
    .estrellas {
      display: flex;
      gap: 0.15rem;
      padding-top: 0.35rem;
    }
    .estrellas button {
      border: 0;
      background: none;
      cursor: pointer;
      font-size: 1.25rem;
      color: #f59e0b;
      padding: 0.1rem;
    }
  `,
})
export class ProveedorDialogo {
  private readonly api = inject(ProveedoresService);
  private readonly store = inject(LogisticaStore);
  private readonly confirmar = usarConfirmacion();

  readonly visible = model(false);
  readonly proveedor = input<Proveedor | null>(null);

  protected readonly tiposDoc: TipoDoc[] = ['RUC', 'DNI', 'CE', 'OTRO'];
  protected readonly tipoDocumento = signal<TipoDoc>('RUC');
  protected readonly numeroDocumento = signal('');
  protected readonly razonSocial = signal('');
  protected readonly rubro = signal('');
  protected readonly contacto = signal('');
  protected readonly telefono = signal('');
  protected readonly correo = signal('');
  protected readonly direccion = signal('');
  protected readonly diasCredito = signal<number | null>(0);
  protected readonly calificacion = signal<number | null>(null);
  protected readonly activo = signal(true);
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      if (!this.visible()) return;
      const p = this.proveedor();
      this.tipoDocumento.set(p?.tipoDocumento ?? 'RUC');
      this.numeroDocumento.set(p?.numeroDocumento ?? '');
      this.razonSocial.set(p?.razonSocial ?? '');
      this.rubro.set(p?.rubro ?? '');
      this.contacto.set(p?.contacto ?? '');
      this.telefono.set(p?.telefono ?? '');
      this.correo.set(p?.correo ?? '');
      this.direccion.set(p?.direccion ?? '');
      this.diasCredito.set(p?.diasCredito ?? 0);
      this.calificacion.set(p?.calificacion ?? null);
      this.activo.set(p?.activo ?? true);
      this.error.set(null);
    });
  }

  async guardar() {
    const doc = this.numeroDocumento().trim();
    if (this.tipoDocumento() === 'RUC' && !/^(10|15|17|20)\d{9}$/.test(doc)) {
      this.error.set('El RUC debe tener 11 dígitos y empezar con 10, 15, 17 o 20');
      return;
    }
    if (!doc || !this.razonSocial().trim()) {
      this.error.set('Documento y razón social son obligatorios');
      return;
    }
    this.guardando.set(true);
    const datos = {
      tipoDocumento: this.tipoDocumento(),
      numeroDocumento: doc,
      razonSocial: this.razonSocial().trim(),
      rubro: this.rubro().trim(),
      contacto: this.contacto().trim(),
      telefono: this.telefono().trim(),
      ...(this.correo().trim() ? { correo: this.correo().trim() } : {}),
      direccion: this.direccion().trim(),
      diasCredito: this.diasCredito() ?? 0,
      ...(this.calificacion() ? { calificacion: this.calificacion()! } : {}),
    };
    try {
      const p = this.proveedor();
      if (p) await this.api.actualizar(p.id, { ...datos, activo: this.activo() });
      else await this.api.crear(datos);
      await this.store.recargar();
      this.store.ok(p ? 'Proveedor actualizado' : 'Proveedor registrado', datos.razonSocial);
      this.visible.set(false);
    } catch (e) {
      this.error.set(mensajeError(e) ?? 'No se pudo guardar');
    } finally {
      this.guardando.set(false);
    }
  }

  /** DELETE real en la BD. Si tiene historial, la API responde por qué y se sugiere desactivar. */
  async eliminar() {
    const x = this.proveedor();
    if (!x) return;
    if (
      !(await this.confirmar(
        `¿Eliminar ${x.razonSocial}?`,
        'Se borra de la base de datos. Esta acción no se puede deshacer.',
      ))
    )
      return;
    this.guardando.set(true);
    this.error.set(null);
    try {
      await this.api.eliminar(x.id);
      await this.store.recargar();
      this.store.ok('Proveedor eliminado', x.razonSocial);
      this.visible.set(false);
    } catch (e) {
      this.error.set(mensajeError(e) ?? 'No se pudo eliminar');
    } finally {
      this.guardando.set(false);
    }
  }
}
