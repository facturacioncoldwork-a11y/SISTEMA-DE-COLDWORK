import { Component, effect, inject, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TIPOS_ALMACEN, type Almacen, type TipoAlmacen } from '../../models/logistica.model';
import { AlmacenesService } from '../../services/almacenes.service';
import { usarConfirmacion } from '../../services/confirmar';
import { LogisticaStore, mensajeError } from '../../services/logistica-store.service';

/** Crear o editar un almacén. */
@Component({
  selector: 'app-almacen-dialogo',
  imports: [FormsModule, DialogModule, InputTextModule, ToggleSwitchModule],
  template: `
    <p-dialog
      [(visible)]="visible"
      [modal]="true"
      [draggable]="false"
      [style]="{ width: 'min(36rem, 96vw)' }"
      [header]="almacen() ? 'Editar almacén' : 'Nuevo almacén'"
    >
      <form class="lg-form" (ngSubmit)="guardar()">
        <div class="full">
          <span class="lbl">Tipo</span>
          <div class="lg-opciones">
            @for (t of tipos; track t.clave) {
              <button type="button" [class.on]="tipo() === t.clave" (click)="tipo.set(t.clave)">
                <i [class]="t.icono"></i><strong>{{ t.nombre }}</strong
                ><small>{{ t.ayuda }}</small>
              </button>
            }
          </div>
        </div>
        <div>
          <label for="a-cod">Código</label>
          <input
            pInputText
            id="a-cod"
            name="codigo"
            placeholder="ALM-01"
            [ngModel]="codigo()"
            (ngModelChange)="codigo.set($event)"
          />
        </div>
        <div>
          <label for="a-nom">Nombre</label>
          <input
            pInputText
            id="a-nom"
            name="nombre"
            placeholder="Almacén central"
            [ngModel]="nombre()"
            (ngModelChange)="nombre.set($event)"
          />
        </div>
        <div class="full">
          <label for="a-dir">Dirección</label>
          <input
            pInputText
            id="a-dir"
            name="dir"
            placeholder="Av. Argentina 1234, Callao"
            [ngModel]="direccion()"
            (ngModelChange)="direccion.set($event)"
          />
        </div>
        <div class="full">
          <label for="a-resp">Responsable</label>
          <input
            pInputText
            id="a-resp"
            name="resp"
            [placeholder]="
              tipo() === 'movil' ? 'Técnico a cargo de la unidad' : 'Encargado del almacén'
            "
            [ngModel]="responsable()"
            (ngModelChange)="responsable.set($event)"
          />
        </div>
        @if (almacen()) {
          <div class="full" style="display: flex; gap: 0.6rem; align-items: center">
            <p-toggleswitch
              inputId="a-act"
              name="act"
              [ngModel]="activo()"
              (ngModelChange)="activo.set($event)"
            />
            <label for="a-act" style="margin: 0">Almacén activo</label>
          </div>
        }
        @if (error(); as e) {
          <p class="error"><i class="pi pi-exclamation-circle"></i> {{ e }}</p>
        }
        <div class="full lg-pie-dialogo">
          @if (almacen()) {
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
})
export class AlmacenDialogo {
  private readonly api = inject(AlmacenesService);
  private readonly store = inject(LogisticaStore);
  private readonly confirmar = usarConfirmacion();

  readonly visible = model(false);
  readonly almacen = input<Almacen | null>(null);

  protected readonly tipos = Object.entries(TIPOS_ALMACEN).map(([clave, t]) => ({
    clave: clave as TipoAlmacen,
    ...t,
  }));
  protected readonly codigo = signal('');
  protected readonly nombre = signal('');
  protected readonly tipo = signal<TipoAlmacen>('principal');
  protected readonly direccion = signal('');
  protected readonly responsable = signal('');
  protected readonly activo = signal(true);
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      if (!this.visible()) return;
      const a = this.almacen();
      this.codigo.set(a?.codigo ?? '');
      this.nombre.set(a?.nombre ?? '');
      this.tipo.set(a?.tipo ?? 'principal');
      this.direccion.set(a?.direccion ?? '');
      this.responsable.set(a?.responsable ?? '');
      this.activo.set(a?.activo ?? true);
      this.error.set(null);
    });
  }

  async guardar() {
    if (!this.codigo().trim() || !this.nombre().trim()) {
      this.error.set('El código y el nombre son obligatorios');
      return;
    }
    this.guardando.set(true);
    const datos = {
      codigo: this.codigo().trim().toUpperCase(),
      nombre: this.nombre().trim(),
      tipo: this.tipo(),
      direccion: this.direccion().trim(),
      responsable: this.responsable().trim(),
    };
    try {
      const a = this.almacen();
      if (a) await this.api.actualizar(a.id, { ...datos, activo: this.activo() });
      else await this.api.crear(datos);
      await this.store.recargar();
      this.store.ok(a ? 'Almacén actualizado' : 'Almacén creado', datos.nombre);
      this.visible.set(false);
    } catch (e) {
      this.error.set(mensajeError(e) ?? 'No se pudo guardar');
    } finally {
      this.guardando.set(false);
    }
  }

  /** DELETE real en la BD. Si tiene historial, la API responde por qué y se sugiere desactivar. */
  async eliminar() {
    const x = this.almacen();
    if (!x) return;
    if (
      !(await this.confirmar(
        `¿Eliminar ${x.nombre}?`,
        'Se borra de la base de datos. Esta acción no se puede deshacer.',
      ))
    )
      return;
    this.guardando.set(true);
    this.error.set(null);
    try {
      await this.api.eliminar(x.id);
      await this.store.recargar();
      this.store.ok('Almacén eliminado', x.nombre);
      this.visible.set(false);
    } catch (e) {
      this.error.set(mensajeError(e) ?? 'No se pudo eliminar');
    } finally {
      this.guardando.set(false);
    }
  }
}
