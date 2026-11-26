import { CurrencyPipe, DatePipe } from '@angular/common';
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
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { desdeBase } from '../../../../core/utils/montos';
import type { OrdenCompra, Producto, ProyectoCompra } from '../../models/logistica.model';
import { colorCliente, hoyISO, seguimiento } from '../../models/plazos';
import { LogisticaStore, mensajeError } from '../../services/logistica-store.service';
import { OrdenesCompraService } from '../../services/ordenes-compra.service';
import { PlazoEntrega, type ValorPlazo } from '../plazo-entrega/plazo-entrega';
import { SelectorProducto } from '../selector-producto/selector-producto';

interface LineaOc {
  producto: Producto;
  cantidad: number;
  costo: number;
}

/**
 * Crear o EDITAR una orden de compra: proveedor, almacén, plazo del
 * proveedor (ventana de llegada), cliente y fecha prometida, productos y totales.
 * En una orden ya enviada solo se editan plazo, cliente, fechas y notas.
 */
@Component({
  selector: 'app-orden-dialogo',
  imports: [
    FormsModule,
    CurrencyPipe,
    DatePipe,
    DialogModule,
    InputNumberModule,
    SelectModule,
    SelectButtonModule,
    SelectorProducto,
    PlazoEntrega,
  ],
  templateUrl: './orden-dialogo.html',
})
export class OrdenDialogo {
  private readonly api = inject(OrdenesCompraService);
  protected readonly store = inject(LogisticaStore);

  readonly visible = model(false);
  /** null = nueva. */
  readonly orden = input<OrdenCompra | null>(null);
  /** Productos con los que se abre una nueva (ej. "Pedir a proveedor"). */
  readonly sugeridos = input<Producto[]>([]);
  readonly guardada = output<OrdenCompra>();

  protected readonly proveedorId = signal<string | null>(null);
  protected readonly almacenId = signal<string | null>(null);
  protected readonly plazo = signal<ValorPlazo>({
    plazoTexto: '',
    entregaDesde: null,
    entregaHasta: null,
  });
  protected readonly plazoInicial = signal<ValorPlazo | null>(null);
  protected readonly cliente = signal('');
  /** Proyecto de Operaciones al que pertenece la compra. */
  protected readonly proyectoId = signal<string | null>(null);
  protected readonly fechaAprobado = signal('');
  protected readonly proyectos = signal<(ProyectoCompra & { etiqueta: string })[]>([]);
  protected readonly compromiso = signal('');
  protected readonly notas = signal('');
  protected readonly moneda = signal<'PEN' | 'USD'>('PEN');
  protected readonly monedas = [
    { t: 'S/ Soles', v: 'PEN' },
    { t: 'US$ Dólares', v: 'USD' },
  ];
  protected readonly lineas = signal<LineaOc[]>([]);
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly editando = computed(() => !!this.orden());
  /** Proveedor, almacén y productos solo se cambian en borrador. */
  protected readonly editaTodo = computed(
    () => !this.orden() || this.orden()!.estado === 'borrador',
  );
  protected readonly base = computed(() => this.orden()?.fecha ?? hoyISO());
  protected readonly ids = computed(() => this.lineas().map((l) => l.producto.id));
  protected readonly totales = computed(() =>
    desdeBase(this.lineas().reduce((t, l) => t + (l.cantidad || 0) * (l.costo || 0), 0)),
  );
  protected readonly proveedor = computed(() =>
    this.store.proveedores().find((p) => p.id === this.proveedorId()),
  );
  /** Aviso en vivo: ¿llega antes de lo que prometimos al cliente? */
  protected readonly aviso = computed(() => {
    if (!this.compromiso()) return null;
    const s = seguimiento({
      estado: 'enviada',
      entregaDesde: this.plazo().entregaDesde,
      entregaHasta: this.plazo().entregaHasta,
      fechaLlegadaReal: null,
      compromisoCliente: this.compromiso(),
      entregadoCliente: null,
    });
    return { texto: s.textoCliente, color: colorCliente(s.cliente) };
  });

  constructor() {
    effect(() => {
      if (!this.visible()) return;
      // Solo se reinicia al ABRIR (o al cambiar lo que se abre). Lo demás se lee sin
      // suscribirse: si no, recargar los catálogos a mitad de un guardado borraba el formulario.
      this.orden();
      this.sugeridos();
      untracked(() => {
        void this.cargarProyectos();
        const o = this.orden();
        const porId = this.store.productoPorId();
        this.error.set(null);
        if (o) {
          this.proveedorId.set(o.proveedor.id);
          this.almacenId.set(o.almacen.id);
          const ini = {
            plazoTexto: o.plazoTexto ?? '',
            entregaDesde: o.entregaDesde,
            entregaHasta: o.entregaHasta,
          };
          this.plazoInicial.set(ini);
          this.plazo.set(ini);
          this.cliente.set(o.cliente ?? '');
          this.proyectoId.set(o.proyecto?.id ?? null);
          this.fechaAprobado.set(o.fechaAprobado ?? '');
          this.compromiso.set(o.compromisoCliente ?? '');
          this.notas.set(o.notas ?? '');
          this.moneda.set(o.moneda);
          this.lineas.set(
            o.items
              .map((i) => ({
                producto: porId.get(i.productoId)!,
                cantidad: i.cantidad,
                costo: i.costoUnitario,
              }))
              .filter((l) => !!l.producto),
          );
        } else {
          this.proveedorId.set(null);
          this.almacenId.set(
            this.store.almacenesActivos().find((a) => a.tipo === 'principal')?.id ?? null,
          );
          this.plazoInicial.set(null);
          this.plazo.set({ plazoTexto: '', entregaDesde: null, entregaHasta: null });
          this.cliente.set('');
          this.proyectoId.set(null);
          this.fechaAprobado.set(hoyISO());
          this.compromiso.set('');
          this.notas.set('');
          this.moneda.set('PEN');
          this.lineas.set(
            this.sugeridos().map((p) => ({
              producto: p,
              // Sugerencia: lo que falta para llegar a 2 veces el mínimo
              cantidad: Math.max(1, Math.ceil(p.stockMinimo * 2 - p.stockTotal)),
              costo: p.costoPromedio,
            })),
          );
        }
      });
    });
  }

  private async cargarProyectos() {
    const lista = await this.api.proyectos().catch(() => []);
    this.proyectos.set(
      lista.map((p) => ({
        ...p,
        etiqueta: `${p.codigo} · ${p.proyecto}${p.cliente ? ' · ' + p.cliente : ''}${p.estado === 'enviada' ? ' (por aprobar)' : ''}`,
      })),
    );
  }

  /** Al elegir el proyecto, si no hay cliente se completa con el del proyecto. */
  protected elegirProyecto(id: string | null) {
    this.proyectoId.set(id);
    const p = this.proyectos().find((x) => x.id === id);
    if (p?.cliente && !this.cliente().trim()) this.cliente.set(`${p.cliente} – ${p.proyecto}`);
  }

  protected agregar(p: Producto) {
    this.lineas.update((l) => [...l, { producto: p, cantidad: 1, costo: p.costoPromedio }]);
  }
  protected cambiar(i: number, campo: 'cantidad' | 'costo', valor: number | null) {
    this.lineas.update((l) => l.map((x, j) => (j === i ? { ...x, [campo]: valor ?? 0 } : x)));
  }
  protected quitar(i: number) {
    this.lineas.update((l) => l.filter((_, j) => j !== i));
  }

  async guardar(enviar: boolean) {
    if (!this.proveedorId() || !this.almacenId())
      return this.error.set('Elige el proveedor y el almacén destino');
    if (!this.lineas().length) return this.error.set('Agrega al menos un producto');
    if (this.lineas().some((l) => !(l.cantidad > 0)))
      return this.error.set('Todas las cantidades deben ser mayores a 0');
    this.guardando.set(true);
    this.error.set(null);
    const p = this.plazo();
    const comunes = {
      plazoTexto: p.plazoTexto,
      entregaDesde: p.entregaDesde,
      entregaHasta: p.entregaHasta,
      cliente: this.cliente().trim(),
      compromisoCliente: this.compromiso() || null,
      notas: this.notas().trim(),
      ...(this.editaTodo() ? { moneda: this.moneda() } : {}),
      fechaAprobado: this.fechaAprobado() || null,
      // Al editar, null quita el proyecto; al crear solo se envía si se eligió
      ...(this.orden() || this.proyectoId() ? { proyectoId: this.proyectoId() } : {}),
    };
    const items = this.lineas().map((l) => ({
      productoId: l.producto.id,
      cantidad: l.cantidad,
      costoUnitario: l.costo,
    }));
    try {
      const o = this.orden();
      let r: OrdenCompra;
      if (o) {
        r = await this.api.actualizar(o.id, {
          ...comunes,
          ...(this.editaTodo()
            ? { proveedorId: this.proveedorId()!, almacenId: this.almacenId()!, items }
            : {}),
        });
        if (enviar && r.estado === 'borrador') r = await this.api.enviar(r.id);
        this.store.ok('Orden actualizada', `${r.codigo} · ${r.proveedor.razonSocial}`);
      } else {
        r = await this.api.crear({
          ...comunes,
          proveedorId: this.proveedorId()!,
          almacenId: this.almacenId()!,
          enviar,
          items,
        });
        this.store.ok(
          enviar ? 'Orden enviada' : 'Borrador guardado',
          `${r.codigo} · ${r.proveedor.razonSocial}`,
        );
      }
      this.guardada.emit(r);
      this.visible.set(false);
    } catch (e) {
      this.error.set(mensajeError(e) ?? 'No se pudo guardar la orden');
    } finally {
      this.guardando.set(false);
    }
  }
}
