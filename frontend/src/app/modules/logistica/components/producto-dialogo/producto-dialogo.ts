import { Component, effect, inject, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import {
  TIPOS_PRODUCTO,
  UNIDADES,
  type Producto,
  type TipoProducto,
} from '../../models/logistica.model';
import { usarConfirmacion } from '../../services/confirmar';
import { LogisticaStore, mensajeError } from '../../services/logistica-store.service';
import { ProductosService } from '../../services/productos.service';

/** Crear o editar un producto del catálogo. */
@Component({
  selector: 'app-producto-dialogo',
  imports: [
    FormsModule,
    DialogModule,
    InputTextModule,
    InputNumberModule,
    SelectModule,
    TextareaModule,
    ToggleSwitchModule,
  ],
  templateUrl: './producto-dialogo.html',
})
export class ProductoDialogo {
  private readonly api = inject(ProductosService);
  private readonly store = inject(LogisticaStore);
  private readonly confirmar = usarConfirmacion();

  readonly visible = model(false);
  /** null = nuevo. */
  readonly producto = input<Producto | null>(null);
  readonly guardado = output<Producto>();

  protected readonly tipos = Object.entries(TIPOS_PRODUCTO).map(([clave, t]) => ({
    clave: clave as TipoProducto,
    ...t,
  }));
  protected readonly unidades = UNIDADES;

  protected readonly sku = signal('');
  protected readonly nombre = signal('');
  protected readonly descripcion = signal('');
  protected readonly tipo = signal<TipoProducto>('repuesto');
  protected readonly marca = signal('');
  protected readonly unidad = signal('UND');
  protected readonly stockMinimo = signal<number | null>(0);
  protected readonly activo = signal(true);
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      if (!this.visible()) return;
      const p = this.producto();
      this.sku.set(p?.sku ?? '');
      this.nombre.set(p?.nombre ?? '');
      this.descripcion.set(p?.descripcion ?? '');
      this.tipo.set(p?.tipo ?? 'repuesto');
      this.marca.set(p?.marca ?? '');
      this.unidad.set(p?.unidad ?? 'UND');
      this.stockMinimo.set(p?.stockMinimo ?? 0);
      this.activo.set(p?.activo ?? true);
      this.error.set(null);
    });
  }

  async guardar() {
    if (!this.sku().trim() || !this.nombre().trim()) {
      this.error.set('El SKU y el nombre son obligatorios');
      return;
    }
    this.guardando.set(true);
    this.error.set(null);
    const datos = {
      sku: this.sku().trim().toUpperCase(),
      nombre: this.nombre().trim(),
      descripcion: this.descripcion().trim(),
      tipo: this.tipo(),
      marca: this.marca().trim(),
      unidad: this.unidad(),
      stockMinimo: this.stockMinimo() ?? 0,
    };
    try {
      const p = this.producto();
      const r = p
        ? await this.api.actualizar(p.id, { ...datos, activo: this.activo() })
        : await this.api.crear(datos);
      await this.store.recargar();
      this.store.ok(p ? 'Producto actualizado' : 'Producto creado', r.nombre);
      this.guardado.emit(r);
      this.visible.set(false);
    } catch (e) {
      this.error.set(mensajeError(e) ?? 'No se pudo guardar');
    } finally {
      this.guardando.set(false);
    }
  }

  /** DELETE real en la BD. Si tiene historial, la API responde por qué y se sugiere desactivar. */
  async eliminar() {
    const x = this.producto();
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
      this.store.ok('Producto eliminado', x.nombre);
      this.visible.set(false);
    } catch (e) {
      this.error.set(mensajeError(e) ?? 'No se pudo eliminar');
    } finally {
      this.guardando.set(false);
    }
  }
}
