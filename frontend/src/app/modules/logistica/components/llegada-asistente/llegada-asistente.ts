import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  input,
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
import type { Llegada, OrdenCompra, Producto } from '../../models/logistica.model';
import { LogisticaStore, mensajeError } from '../../services/logistica-store.service';
import { MovimientosService } from '../../services/movimientos.service';
import { diasEntre, hoyISO } from '../../models/plazos';
import { SelectorProducto } from '../selector-producto/selector-producto';

/** Hoy → ahora mismo; otro día → ese día a mediodía (hora local). */
function aFechaHora(dia: string): string {
  return dia === hoyISO() ? new Date().toISOString() : new Date(`${dia}T12:00:00`).toISOString();
}

interface LineaLlegada {
  producto: Producto;
  cantidad: number;
  costo: number;
  /** Pendiente en la OC (solo si viene de una). */
  pendiente?: number;
}

/**
 * Asistente de LLEGADA en 3 pasos: origen → productos → confirmar.
 * Si viene de una OC, trae lo pendiente y al guardar la BD actualiza su avance.
 */
@Component({
  selector: 'app-llegada-asistente',
  imports: [
    FormsModule,
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    DialogModule,
    InputNumberModule,
    InputTextModule,
    SelectModule,
    SelectorProducto,
  ],
  templateUrl: './llegada-asistente.html',
})
export class LlegadaAsistente {
  private readonly api = inject(MovimientosService);
  protected readonly store = inject(LogisticaStore);

  readonly visible = model(false);
  /** OCs enviadas o parciales. */
  readonly ordenes = input<OrdenCompra[]>([]);
  readonly ordenInicial = input<string | null>(null);
  readonly registrada = output<Llegada>();

  protected readonly paso = signal(1);
  protected readonly modo = signal<'oc' | 'directa'>('oc');
  protected readonly ordenId = signal<string | null>(null);
  protected readonly proveedorId = signal<string | null>(null);
  protected readonly almacenId = signal<string | null>(null);
  protected readonly lineas = signal<LineaLlegada[]>([]);
  protected readonly guia = signal('');
  protected readonly comprobante = signal('');
  protected readonly notas = signal('');
  /** Día en que llegó de verdad (por defecto hoy). */
  protected readonly fechaLlegada = signal(hoyISO());
  /** Solo si la OC está en dólares: S/ por cada US$ (el inventario se lleva en soles). */
  protected readonly tipoCambio = signal<number | null>(null);
  protected readonly enDolares = computed(() => this.orden()?.moneda === 'USD');
  /** Total en soles (lo que entra al inventario). */
  protected readonly totalSoles = computed(() =>
    this.enDolares() ? this.total() * (this.tipoCambio() ?? 0) : this.total(),
  );
  protected readonly hoy = hoyISO();
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);

  /** Comparación con lo que dijo el proveedor. */
  protected readonly puntualidad = computed(() => {
    const o = this.orden();
    if (!o?.entregaHasta) return null;
    const d = diasEntre(o.entregaHasta, this.fechaLlegada());
    return d > 0
      ? {
          texto: `Llegó ${d} día(s) tarde respecto a lo prometido (${o.plazoTexto ?? 'fecha'})`,
          color: '#dc2626',
        }
      : { texto: `Llegó a tiempo (${o.plazoTexto ?? 'fecha'})`, color: '#059669' };
  });
  protected readonly orden = computed(
    () => this.ordenes().find((o) => o.id === this.ordenId()) ?? null,
  );
  protected readonly ids = computed(() => this.lineas().map((l) => l.producto.id));
  protected readonly total = computed(() =>
    this.lineas().reduce((t, l) => t + (l.cantidad || 0) * (l.costo || 0), 0),
  );
  protected readonly unidades = computed(() =>
    this.lineas().reduce((t, l) => t + (l.cantidad || 0), 0),
  );
  protected readonly nombreAlmacen = computed(
    () => this.store.almacenPorId().get(this.almacenId() ?? '')?.nombre ?? '—',
  );
  protected readonly nombreProveedor = computed(
    () =>
      this.orden()?.proveedor.razonSocial ??
      this.store.proveedores().find((p) => p.id === this.proveedorId())?.razonSocial ??
      'Sin proveedor',
  );

  constructor() {
    effect(() => {
      if (!this.visible()) return;
      // Solo se reinicia al ABRIR (o al cambiar lo que se abre). Lo demás se lee sin
      // suscribirse: si no, recargar los catálogos a mitad de un guardado borraba el formulario.
      this.ordenInicial();
      untracked(() => {
        this.paso.set(1);
        this.error.set(null);
        this.guia.set('');
        this.comprobante.set('');
        this.notas.set('');
        this.fechaLlegada.set(hoyISO());
        this.tipoCambio.set(null);
        this.lineas.set([]);
        this.proveedorId.set(null);
        const ini = this.ordenInicial();
        this.modo.set(ini || this.ordenes().length ? 'oc' : 'directa');
        this.ordenId.set(null);
        this.almacenId.set(
          this.store.almacenesActivos().find((a) => a.tipo === 'principal')?.id ?? null,
        );
        if (ini) this.elegirOrden(ini);
      });
    });
  }

  protected elegirOrden(id: string) {
    const o = this.ordenes().find((x) => x.id === id);
    if (!o) return;
    this.ordenId.set(id);
    this.almacenId.set(o.almacen.id);
    const porId = this.store.productoPorId();
    this.lineas.set(
      o.items
        .filter((i) => i.cantidad > i.cantidadRecibida)
        .map((i) => {
          const pendiente = i.cantidad - i.cantidadRecibida;
          return {
            producto: porId.get(i.productoId)!,
            cantidad: pendiente,
            costo: i.costoUnitario,
            pendiente,
          };
        })
        .filter((l) => !!l.producto),
    );
  }

  protected cambiarModo(m: 'oc' | 'directa') {
    this.modo.set(m);
    this.ordenId.set(null);
    this.lineas.set([]);
  }

  protected agregar(p: Producto) {
    this.lineas.update((l) => [...l, { producto: p, cantidad: 1, costo: p.costoPromedio }]);
  }
  protected cambiar(i: number, campo: 'cantidad' | 'costo', v: number | null) {
    this.lineas.update((l) => l.map((x, j) => (j === i ? { ...x, [campo]: v ?? 0 } : x)));
  }
  protected quitar(i: number) {
    this.lineas.update((l) => l.filter((_, j) => j !== i));
  }

  protected siguiente() {
    this.error.set(null);
    if (this.paso() === 1) {
      if (this.modo() === 'oc' && !this.ordenId())
        return this.error.set('Elige la orden de compra que está llegando');
      if (!this.almacenId()) return this.error.set('Elige el almacén');
    }
    if (this.paso() === 2) {
      if (!this.lineas().length) return this.error.set('Agrega al menos un producto');
      if (this.lineas().some((l) => !(l.cantidad > 0)))
        return this.error.set('Las cantidades deben ser mayores a 0 (quita las que no llegaron)');
    }
    this.paso.update((p) => p + 1);
  }

  async registrar() {
    if (this.enDolares() && !(this.tipoCambio()! > 0)) {
      this.error.set('La orden está en dólares: indica el tipo de cambio del día (S/ por US$).');
      return;
    }
    const tc = this.enDolares() ? this.tipoCambio()! : 1;
    this.guardando.set(true);
    this.error.set(null);
    try {
      const r = await this.api.registrarLlegada({
        almacenId: this.almacenId()!,
        ...(this.ordenId() ? { ordenId: this.ordenId()! } : {}),
        ...(this.modo() === 'directa' && this.proveedorId()
          ? { proveedorId: this.proveedorId()! }
          : {}),
        guiaRemision: this.guia().trim(),
        comprobante: this.comprobante().trim(),
        notas: this.notas().trim(),
        fecha: aFechaHora(this.fechaLlegada()),
        ...(this.enDolares() ? { moneda: 'USD' as const, tipoCambio: tc } : {}),
        items: this.lineas().map((l) => ({
          productoId: l.producto.id,
          cantidad: l.cantidad,
          // al inventario entra en soles
          costoUnitario: Math.round(l.costo * tc * 10000) / 10000,
        })),
      });
      await this.store.recargar();
      this.store.ok(
        `Llegada ${r.codigo} registrada`,
        `${this.unidades()} unidades ingresaron a ${r.almacen.nombre}`,
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
