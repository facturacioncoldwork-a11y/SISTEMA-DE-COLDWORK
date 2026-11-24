import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, computed, HostListener, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { KardexPanel } from '../../components/kardex-panel/kardex-panel';
import { MedidorStock } from '../../components/medidor-stock/medidor-stock';
import { ProductoDialogo } from '../../components/producto-dialogo/producto-dialogo';
import {
  NIVELES_ANTIGUEDAD,
  textoAntiguedad,
  textoCorto,
  type Antiguedad,
} from '../../models/antiguedad';
import {
  nivelStock,
  TIPOS_PRODUCTO,
  type NivelStock,
  type Producto,
  type TipoProducto,
} from '../../models/logistica.model';
import { usarEliminarProducto } from '../../services/eliminar-producto';
import { LogisticaStore } from '../../services/logistica-store.service';

type FiltroNivel = 'todos' | 'ok' | 'reponer' | 'sin_stock' | 'antiguos';
type Orden = 'nombre' | 'stock' | 'valor' | 'antiguedad';

/** Vista: INVENTARIO (control de stock por producto y almacén). */
@Component({
  selector: 'app-inventario',
  imports: [
    FormsModule,
    CurrencyPipe,
    DecimalPipe,
    SelectModule,
    TooltipModule,
    MedidorStock,
    KardexPanel,
    ProductoDialogo,
  ],
  templateUrl: './inventario.html',
  styleUrl: './inventario.scss',
})
export class Inventario implements OnInit {
  protected readonly store = inject(LogisticaStore);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly eliminarProducto = usarEliminarProducto();

  protected readonly tipos = TIPOS_PRODUCTO;
  protected readonly nivelesEdad = NIVELES_ANTIGUEDAD;
  protected readonly opcionesTipo = Object.entries(TIPOS_PRODUCTO).map(([clave, t]) => ({
    clave,
    nombre: t.nombre,
  }));

  protected readonly texto = signal('');
  protected readonly nivel = signal<FiltroNivel>('todos');
  protected readonly tipo = signal<TipoProducto | null>(null);
  protected readonly almacen = signal<string | null>(null);
  protected readonly vista = signal<'tabla' | 'tarjetas'>('tabla');
  protected readonly orden = signal<Orden>('nombre');
  protected readonly verInactivos = signal(false);

  protected readonly seleccionado = signal<Producto | null>(null);
  protected readonly kardexVisible = signal(false);
  protected readonly dialogoVisible = signal(false);
  protected readonly editando = signal<Producto | null>(null);

  /** Stock que cuenta según el almacén filtrado. */
  protected cantidad(p: Producto): number {
    const a = this.almacen();
    return a ? (p.stock.find((s) => s.almacenId === a)?.cantidad ?? 0) : p.stockTotal;
  }
  private nivelDe(p: Producto): NivelStock {
    return nivelStock(this.cantidad(p), this.almacen() ? 0 : p.stockMinimo);
  }
  protected edad(p: Producto): Antiguedad | undefined {
    return this.store.antiguedad().get(p.id);
  }
  protected edadCorta(p: Producto): string {
    const d = this.edad(p)?.desde;
    return d ? textoCorto(d) : '—';
  }
  /** Texto del aviso al pasar el mouse. */
  protected edadAyuda(p: Producto): string {
    const a = this.edad(p);
    if (!a?.desde) return 'Sin stock';
    const base = `Lo más antiguo lleva ${textoAntiguedad(a.desde)} en almacén`;
    return a.nivel === 'antiguo'
      ? `${base}. ${a.cantidadAntigua} ${p.unidad} pasan de ${this.store.mesesAntiguedad()} meses: véndelos pronto, aunque sea con descuento.`
      : a.nivel === 'envejeciendo'
        ? `${base}. Se está poniendo antiguo: úsalo o véndelo primero.`
        : base;
  }
  private filtra(p: Producto, f: FiltroNivel): boolean {
    const n = this.nivelDe(p);
    switch (f) {
      case 'todos':
        return true;
      case 'ok':
        return n === 'ok';
      case 'reponer':
        return n === 'critico' || n === 'bajo' || n === 'agotado';
      case 'sin_stock':
        return n === 'agotado' || n === 'vacio';
      case 'antiguos':
        return this.edad(p)?.nivel === 'antiguo';
    }
  }

  private readonly base = computed(() => {
    const t = this.texto().trim().toLowerCase();
    return this.store
      .productos()
      .filter((p) => this.verInactivos() || p.activo)
      .filter((p) => !this.tipo() || p.tipo === this.tipo())
      .filter((p) => !this.almacen() || p.stock.some((s) => s.almacenId === this.almacen()))
      .filter((p) => !t || `${p.nombre} ${p.sku} ${p.marca ?? ''}`.toLowerCase().includes(t));
  });

  protected readonly conteo = computed(() => {
    const c: Record<FiltroNivel, number> = {
      todos: 0,
      ok: 0,
      reponer: 0,
      sin_stock: 0,
      antiguos: 0,
    };
    for (const p of this.base()) {
      for (const f of Object.keys(c) as FiltroNivel[]) if (this.filtra(p, f)) c[f]++;
    }
    return c;
  });

  protected readonly lista = computed(() => {
    const f = this.nivel();
    const r = this.base().filter((p) => this.filtra(p, f));
    const o = this.orden();
    const desde = (p: Producto) => this.edad(p)?.desde ?? '9999';
    return [...r].sort((a, b) =>
      o === 'nombre'
        ? a.nombre.localeCompare(b.nombre)
        : o === 'stock'
          ? this.cantidad(a) - this.cantidad(b)
          : o === 'antiguedad'
            ? desde(a).localeCompare(desde(b))
            : b.valorizado - a.valorizado,
    );
  });

  protected readonly totalValor = computed(() =>
    this.lista().reduce((t, p) => t + p.valorizado, 0),
  );

  ngOnInit() {
    const q = this.ruta.snapshot.queryParamMap;
    const n = q.get('nivel');
    if (n === 'reponer' || n === 'sin_stock' || n === 'ok') this.nivel.set(n);
    if (n === 'agotado') this.nivel.set('sin_stock');
    if (n === 'antiguos') {
      this.nivel.set('antiguos');
      this.orden.set('antiguedad');
    }
    if (q.get('nuevo')) this.nuevo();
  }

  /** "/" enfoca el buscador. */
  @HostListener('document:keydown', ['$event'])
  protected atajo(e: KeyboardEvent) {
    const t = e.target as HTMLElement;
    if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(t.tagName)) {
      e.preventDefault();
      document.getElementById('inv-buscar')?.focus();
    }
  }

  protected abrir(p: Producto) {
    this.seleccionado.set(p);
    this.kardexVisible.set(true);
  }
  protected nuevo() {
    this.editando.set(null);
    this.dialogoVisible.set(true);
  }
  protected editar(p: Producto) {
    this.kardexVisible.set(false);
    this.editando.set(p);
    this.dialogoVisible.set(true);
  }
  protected async eliminar(p: Producto, ev: Event) {
    ev.stopPropagation();
    if ((await this.eliminarProducto(p)) && this.seleccionado()?.id === p.id) {
      this.kardexVisible.set(false);
    }
  }
  protected pedir(p: Producto) {
    void this.router.navigate(['/logistica/ordenes-compra'], { queryParams: { producto: p.id } });
  }
  protected alGuardar(p: Producto) {
    if (this.seleccionado()?.id === p.id) this.seleccionado.set(p);
  }

  protected nombreAlmacen(id: string) {
    return this.store.almacenPorId().get(id)?.codigo ?? '?';
  }

  /** Descarga lo filtrado como CSV (abre en Excel). */
  protected exportar() {
    const filas = [
      [
        'SKU',
        'Producto',
        'Tipo',
        'Marca',
        'Unidad',
        'Stock',
        'Mínimo',
        'Costo promedio',
        'Valorizado',
        'Ingreso más antiguo',
        'Tiempo en almacén',
        'Cantidad antigua',
      ],
      ...this.lista().map((p) => [
        p.sku,
        p.nombre,
        TIPOS_PRODUCTO[p.tipo].nombre,
        p.marca ?? '',
        p.unidad,
        String(this.cantidad(p)),
        String(p.stockMinimo),
        p.costoPromedio.toFixed(2),
        p.valorizado.toFixed(2),
        this.edad(p)?.desde?.slice(0, 10) ?? '',
        this.edad(p)?.desde ? textoAntiguedad(this.edad(p)!.desde!) : '',
        String(this.edad(p)?.cantidadAntigua ?? 0),
      ]),
    ];
    const csv =
      '﻿' + filas.map((f) => f.map((c) => `"${c.replaceAll('"', '""')}"`).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), {
      href: url,
      download: `inventario-${new Date().toISOString().slice(0, 10)}.csv`,
    });
    a.click();
    URL.revokeObjectURL(url);
  }
}
