import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectButtonModule } from 'primeng/selectbutton';
import type { GuardarTercero, Tercero, TipoDocumentoIdentidad } from '../../models/finanzas.model';
import { FinanzasApi } from '../../services/finanzas-api.service';
import { mensajeError } from '../../services/finanzas-store.service';
import { rucValido } from '../../utils/calculos';

/** Crear o editar un cliente o proveedor (comparte la ficha con Logística). */
@Component({
  selector: 'app-tercero-dialogo',
  imports: [FormsModule, CheckboxModule, DialogModule, InputNumberModule, InputTextModule, SelectButtonModule],
  templateUrl: './tercero-dialogo.html',
  styles: `
    .roles { display: flex; gap: 1.5rem; flex-wrap: wrap; }
    .chk { display: flex; gap: 0.5rem; align-items: center; font-size: 0.9rem; font-weight: 600; }
    .ayuda { display: block; margin-top: 0.3rem; font-size: 0.76rem; color: var(--lg-muted); }
  `,
})
export class TerceroDialogo {
  private readonly api = inject(FinanzasApi);

  readonly visible = model(false);
  readonly tercero = input<Tercero | null>(null);
  /** Valores iniciales al crear (ej. marcar como cliente). */
  readonly sugerido = input<Partial<GuardarTercero>>({});
  readonly guardado = output<string>();

  protected readonly tiposDoc: TipoDocumentoIdentidad[] = ['RUC', 'DNI', 'CE', 'OTRO'];
  protected readonly tipoDocumento = signal<TipoDocumentoIdentidad>('RUC');
  protected readonly numeroDocumento = signal('');
  protected razonSocial = '';
  protected esCliente = true;
  protected esProveedor = false;
  protected rubro = '';
  protected contacto = '';
  protected telefono = '';
  protected correo = '';
  protected direccion = '';
  protected diasCredito = 0;
  protected activo = true;

  protected readonly error = signal<string | null>(null);
  protected readonly guardando = signal(false);

  /** Aviso en vivo mientras escribe el RUC o DNI. */
  protected readonly avisoDocumento = computed(() => {
    const n = this.numeroDocumento().trim();
    if (!n) return null;
    if (this.tipoDocumento() === 'RUC' && n.length === 11 && !rucValido(n)) return 'RUC no válido: revisa los dígitos.';
    if (this.tipoDocumento() === 'DNI' && n.length > 8) return 'El DNI tiene 8 dígitos.';
    return null;
  });

  constructor() {
    effect(() => {
      if (!this.visible()) return;
      const t = this.tercero();
      const s = this.sugerido();
      this.tipoDocumento.set(t?.tipoDocumento ?? s.tipoDocumento ?? 'RUC');
      this.numeroDocumento.set(t?.numeroDocumento ?? '');
      this.razonSocial = t?.razonSocial ?? '';
      this.esCliente = t?.esCliente ?? s.esCliente ?? true;
      this.esProveedor = t?.esProveedor ?? s.esProveedor ?? false;
      this.rubro = t?.rubro ?? '';
      this.contacto = t?.contacto ?? '';
      this.telefono = t?.telefono ?? '';
      this.correo = t?.correo ?? '';
      this.direccion = t?.direccion ?? '';
      this.diasCredito = t?.diasCredito ?? 0;
      this.activo = t?.activo ?? true;
      this.error.set(null);
    });
  }

  protected async guardar() {
    const numero = this.numeroDocumento().trim().toUpperCase();
    if (this.tipoDocumento() === 'RUC' && !rucValido(numero)) return this.error.set('El RUC no es válido.');
    if (this.tipoDocumento() === 'DNI' && !/^\d{8}$/.test(numero)) return this.error.set('El DNI debe tener 8 dígitos.');
    if (!this.razonSocial.trim()) return this.error.set('Escribe la razón social o el nombre.');
    if (!this.esCliente && !this.esProveedor) return this.error.set('Marca si es cliente, proveedor o ambos.');

    const datos: GuardarTercero = {
      tipoDocumento: this.tipoDocumento(),
      numeroDocumento: numero,
      razonSocial: this.razonSocial.trim(),
      esCliente: this.esCliente,
      esProveedor: this.esProveedor,
      rubro: this.rubro.trim() || undefined,
      contacto: this.contacto.trim() || undefined,
      telefono: this.telefono.trim() || undefined,
      correo: this.correo.trim() || undefined,
      direccion: this.direccion.trim() || undefined,
      diasCredito: this.diasCredito ?? 0,
      activo: this.activo,
    };

    this.guardando.set(true);
    this.error.set(null);
    try {
      const t = this.tercero();
      const id = t ? (await this.api.actualizarTercero(t.id, datos), t.id) : (await this.api.crearTercero(datos)).id;
      this.guardado.emit(id);
      this.visible.set(false);
    } catch (e) {
      this.error.set(mensajeError(e) ?? 'No se pudo guardar.');
    } finally {
      this.guardando.set(false);
    }
  }
}
