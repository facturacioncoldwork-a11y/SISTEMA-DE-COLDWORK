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
  nivelStock,
  TIPOS_PRODUCTO,
  type NivelStock,
  type Producto,
  type TipoProducto,
} from '../../models/logistica.model';
import { LogisticaStore } from '../../services/logistica-store.service';

type FiltroNivel = 'todos' | 'ok' | 'reponer' | 'agotado';
type Orden = 'nombre' | 'stock' | 'valor';

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

  protected readonly tipos = TIPOS_PRODUCTO;
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
    const c = { todos: 0, ok: 0, reponer: 0, agotado: 0 };
    for (const p of this.base()) {
      const n = this.nivelDe(p);
      c.todos++;
      if (n === 'agotado') c.agotado++;
      else if (n === 'critico' || n === 'bajo') c.reponer++;
      else c.ok++;
    }
    return c;
  });

  protected readonly lista = computed(() => {
    const f = this.nivel();
    const r = this.base().filter((p) => {
      const n = this.nivelDe(p);
      return (
        f === 'todos' ||
        (f === 'agotado'
          ? n === 'agotado'
          : f === 'reponer'
            ? n === 'critico' || n === 'bajo'
            : n === 'ok')
      );
    });
    const o = this.orden();
    return [...r].sort((a, b) =>
      o === 'nombre'
        ? a.nombre.localeCompare(b.nombre)
        : o === 'stock'
          ? this.cantidad(a) - this.cantidad(b)
          : b.valorizado - a.valorizado,
    );
  });

  protected readonly totalValor = computed(() =>
    this.lista().reduce((t, p) => t + p.valorizado, 0),
  );

  ngOnInit() {
    const q = this.ruta.snapshot.queryParamMap;
    const n = q.get('nivel');
    if (n === 'reponer' || n === 'agotado' || n === 'ok') this.nivel.set(n);
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
