import { CurrencyPipe, DecimalPipe } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import {
  MOTIVOS_SALIDA,
  type MotivoSalida,
  type Producto,
  type Salida,
} from '../../models/logistica.model';
import { LogisticaStore, mensajeError } from '../../services/logistica-store.service';
import { MovimientosService } from '../../services/movimientos.service';
import { SelectorProducto } from '../selector-producto/selector-producto';

interface LineaSalida {
  producto: Producto;
  cantidad: number;
}

/**
 * Asistente de SALIDA en 3 pasos: motivo y destino → productos → confirmar.
 * Muestra el stock disponible del almacén y no deja sacar más de lo que hay
 * (la BD también lo bloquea).
 */
@Component({
  selector: 'app-salida-asistente',
  imports: [
    FormsModule,
    CurrencyPipe,
    DecimalPipe,
    DialogModule,
    InputNumberModule,
    InputTextModule,
    SelectModule,
    SelectorProducto,
  ],
  templateUrl: './salida-asistente.html',
})
export class SalidaAsistente {
  private readonly api = inject(MovimientosService);
  protected readonly store = inject(LogisticaStore);

  readonly visible = model(false);
  readonly registrada = output<Salida>();

  protected readonly motivos = Object.entries(MOTIVOS_SALIDA).map(([clave, m]) => ({
    clave: clave as MotivoSalida,
    ...m,
  }));
  protected readonly paso = signal(1);
  protected readonly motivo = signal<MotivoSalida>('servicio_tecnico');
  protected readonly almacenId = signal<string | null>(null);
  protected readonly destinoId = signal<string | null>(null);
  protected readonly destino = signal('');
  protected readonly responsable = signal('');
  protected readonly referencia = signal('');
  protected readonly notas = signal('');
  protected readonly lineas = signal<LineaSalida[]>([]);
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly ids = computed(() => this.lineas().map((l) => l.producto.id));
  protected readonly destinos = computed(() =>
    this.store.almacenesActivos().filter((a) => a.id !== this.almacenId()),
  );
  protected readonly excede = computed(() =>
    this.lineas().some((l) => l.cantidad > this.disponible(l.producto.id)),
  );
  protected readonly total = computed(() =>
    this.lineas().reduce((t, l) => t + l.cantidad * l.producto.costoPromedio, 0),
  );
  protected readonly unidades = computed(() =>
    this.lineas().reduce((t, l) => t + (l.cantidad || 0), 0),
  );
  protected readonly textoMotivo = computed(() => MOTIVOS_SALIDA[this.motivo()].nombre);
  protected readonly nombreAlmacen = (id: string | null) =>
    this.store.almacenPorId().get(id ?? '')?.nombre ?? '—';

  constructor() {
    effect(() => {
      if (!this.visible()) return;
      // Solo se reinicia al ABRIR (o al cambiar lo que se abre). Lo demás se lee sin
      // suscribirse: si no, recargar los catálogos a mitad de un guardado borraba el formulario.
      untracked(() => {
        this.paso.set(1);
        this.motivo.set('servicio_tecnico');
        this.almacenId.set(
          this.store.almacenesActivos().find((a) => a.tipo === 'principal')?.id ?? null,
        );
        this.destinoId.set(null);
        this.destino.set('');
        this.responsable.set('');
        this.referencia.set('');
        this.notas.set('');
        this.lineas.set([]);
        this.error.set(null);
      });
    });
  }

  protected disponible(productoId: string): number {
    return this.almacenId() ? this.store.stockEn(productoId, this.almacenId()!) : 0;
  }

  protected agregar(p: Producto) {
    this.lineas.update((l) => [
      ...l,
      { producto: p, cantidad: Math.min(1, this.disponible(p.id)) || 1 },
    ]);
  }
  protected cambiar(i: number, v: number | null) {
    this.lineas.update((l) => l.map((x, j) => (j === i ? { ...x, cantidad: v ?? 0 } : x)));
  }
  protected quitar(i: number) {
    this.lineas.update((l) => l.filter((_, j) => j !== i));
  }
  protected todo(i: number) {
    const l = this.lineas()[i];
    this.cambiar(i, this.disponible(l.producto.id));
  }

  protected siguiente() {
    this.error.set(null);
    if (this.paso() === 1) {
      if (!this.almacenId()) return this.error.set('Elige de qué almacén sale');
      if (this.motivo() === 'transferencia' && !this.destinoId())
        return this.error.set('Elige el almacén destino');
      if (this.motivo() === 'servicio_tecnico' && !this.responsable().trim())
        return this.error.set('Indica qué técnico retira el material');
    }
    if (this.paso() === 2) {
      if (!this.lineas().length) return this.error.set('Agrega al menos un producto');
      if (this.lineas().some((l) => !(l.cantidad > 0)))
        return this.error.set('Las cantidades deben ser mayores a 0');
      if (this.excede())
        return this.error.set('Hay productos con más cantidad que el stock disponible');
    }
    this.paso.update((p) => p + 1);
  }

  async registrar() {
    this.guardando.set(true);
    this.error.set(null);
    try {
      const r = await this.api.registrarSalida({
        almacenId: this.almacenId()!,
        motivo: this.motivo(),
        ...(this.motivo() === 'transferencia' ? { almacenDestinoId: this.destinoId()! } : {}),
        destino: this.destino().trim(),
        responsable: this.responsable().trim(),
        referencia: this.referencia().trim(),
        notas: this.notas().trim(),
        items: this.lineas().map((l) => ({ productoId: l.producto.id, cantidad: l.cantidad })),
      });
      await this.store.recargar();
      this.store.ok(
        `Salida ${r.codigo} registrada`,
        `${this.unidades()} unidades salieron de ${r.almacen.nombre}`,
      );
      this.registrada.emit(r);
      this.visible.set(false);
    } catch (e) {
      this.error.set(mensajeError(e) ?? 'No se pudo registrar');
    } finally {
      this.guardando.set(false);
    }
  }
}
