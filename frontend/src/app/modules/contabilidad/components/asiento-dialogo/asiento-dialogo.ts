import { Component, computed, effect, inject, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { ORIGENES, TASA_IGV, TIPOS_COMPROBANTE } from '../../data/sunat';
import type { LineaAsiento, Moneda, NuevoAsiento, OrigenAsiento } from '../../models/contabilidad.model';
import { ImportePipe } from '../../pipes/formato.pipes';
import { ContabilidadService } from '../../services/contabilidad.service';
import { redondear, totales, validarAsiento } from '../../utils/partida-doble';

/** Lo que devuelve el diálogo: el asiento y si se registra o queda como borrador. */
export interface AsientoGuardado {
  asiento: NuevoAsiento;
  registrar: boolean;
}

/** Ventana para crear un asiento: cabecera, comprobante y líneas con control de cuadre. */
@Component({
  selector: 'app-asiento-dialogo',
  imports: [
    FormsModule,
    ButtonModule,
    DialogModule,
    InputNumberModule,
    InputTextModule,
    MessageModule,
    SelectModule,
    SelectButtonModule,
    ImportePipe,
  ],
  templateUrl: './asiento-dialogo.html',
  styleUrl: './asiento-dialogo.scss',
})
export class AsientoDialogo {
  private readonly conta = inject(ContabilidadService);

  readonly visible = model(false);
  readonly guardar = output<AsientoGuardado>();

  // ─── Opciones ─────────────────────────────────────────────────
  protected readonly origenes = ORIGENES;
  protected readonly comprobantes = TIPOS_COMPROBANTE;
  protected readonly monedas = [
    { etiqueta: 'Soles', valor: 'PEN' },
    { etiqueta: 'Dólares', valor: 'USD' },
  ];
  protected readonly cuentas = this.conta.cuentasMovimiento.map((c) => ({
    ...c,
    etiqueta: `${c.codigo} · ${c.nombre}`,
  }));

  // ─── Formulario ───────────────────────────────────────────────
  protected fecha = '';
  protected glosa = '';
  protected origen: OrigenAsiento = 'diario';
  protected readonly moneda = signal<Moneda>('PEN');
  protected tipoCambio: number | null = null;
  protected conDocumento = false;
  protected documento = { tipo: '01', serie: '', numero: '', documentoTercero: '', nombreTercero: '' };
  protected readonly lineas = signal<LineaAsiento[]>([]);
  protected readonly errores = signal<string[]>([]);

  protected readonly suma = computed(() => totales(this.lineas()));

  constructor() {
    // Al abrir: formulario limpio con dos líneas vacías
    effect(() => {
      if (!this.visible()) return;
      this.fecha = new Date().toISOString().slice(0, 10);
      this.glosa = '';
      this.origen = 'diario';
      this.moneda.set('PEN');
      this.tipoCambio = null;
      this.conDocumento = false;
      this.documento = { tipo: '01', serie: '', numero: '', documentoTercero: '', nombreTercero: '' };
      this.lineas.set([lineaVacia(), lineaVacia()]);
      this.errores.set([]);
    });
  }

  // ─── Líneas ───────────────────────────────────────────────────

  protected agregarLinea() {
    this.lineas.update((l) => [...l, lineaVacia()]);
  }

  protected quitarLinea(i: number) {
    this.lineas.update((l) => l.filter((_, j) => j !== i));
  }

  /** Actualiza un campo de una línea; al poner Debe se limpia Haber y viceversa. */
  protected cambiar(i: number, campo: keyof LineaAsiento, valor: string | number | null) {
    this.lineas.update((l) =>
      l.map((linea, j) => {
        if (j !== i) return linea;
        const nueva = { ...linea, [campo]: valor ?? 0 };
        if (campo === 'debe' && Number(valor) > 0) nueva.haber = 0;
        if (campo === 'haber' && Number(valor) > 0) nueva.debe = 0;
        return nueva;
      }),
    );
  }

  /** Pone en la línea la diferencia que falta para cuadrar. */
  protected cuadrarEn(i: number) {
    const sinEsta = totales(this.lineas().filter((_, j) => j !== i));
    const falta = redondear(sinEsta.debe - sinEsta.haber);
    this.cambiar(i, falta > 0 ? 'haber' : 'debe', Math.abs(falta));
  }

  /** Atajo: arma una venta o compra gravada con IGV a partir del valor de venta. */
  protected plantillaIgv(tipo: 'venta' | 'compra') {
    const base = this.suma().debe || this.suma().haber || 1000;
    const igv = redondear(base * TASA_IGV);
    const total = redondear(base + igv);
    this.origen = tipo === 'venta' ? 'ventas' : 'compras';
    this.conDocumento = true;
    this.lineas.set(
      tipo === 'venta'
        ? [
            { cuenta: '1212', debe: total, haber: 0 },
            { cuenta: '40111', debe: 0, haber: igv },
            { cuenta: '7041', debe: 0, haber: base },
          ]
        : [
            { cuenta: '6033', debe: base, haber: 0 },
            { cuenta: '40111', debe: igv, haber: 0 },
            { cuenta: '4212', debe: 0, haber: total },
          ],
    );
  }

  // ─── Guardar ──────────────────────────────────────────────────

  protected enviar(registrar: boolean) {
    const asiento = this.armar();
    const errores = registrar ? validarAsiento(asiento, this.conta.porCodigo) : this.minimos(asiento);
    this.errores.set(errores);
    if (errores.length === 0) this.guardar.emit({ asiento, registrar });
  }

  private armar(): NuevoAsiento {
    return {
      fecha: this.fecha,
      glosa: this.glosa.trim(),
      origen: this.origen,
      moneda: this.moneda(),
      tipoCambio: this.moneda() === 'USD' ? (this.tipoCambio ?? undefined) : undefined,
      documento: this.conDocumento ? { ...this.documento } : undefined,
      lineas: this.lineas().filter((l) => l.cuenta || l.debe || l.haber),
    };
  }

  /** Para un borrador basta con fecha y glosa. */
  private minimos(a: NuevoAsiento): string[] {
    const errores: string[] = [];
    if (!a.fecha) errores.push('Falta la fecha de la operación.');
    if (!a.glosa) errores.push('Escribe la glosa (descripción de la operación).');
    return errores;
  }
}

function lineaVacia(): LineaAsiento {
  return { cuenta: '', debe: 0, haber: 0 };
}
