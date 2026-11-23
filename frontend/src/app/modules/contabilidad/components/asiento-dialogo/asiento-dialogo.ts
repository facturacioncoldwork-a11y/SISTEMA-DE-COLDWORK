import { Component, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { ORIGENES, TASA_IGV, TIPOS_COMPROBANTE } from '../../data/sunat';
import type { Adjunto, Asiento, LineaAsiento, Moneda, NuevoAsiento, OrigenAsiento } from '../../models/contabilidad.model';
import { pesoLegible, problemaArchivo } from '../../utils/adjuntos';
import { ImportePipe } from '../../pipes/formato.pipes';
import { ContabilidadService } from '../../services/contabilidad.service';
import { redondear, totales, validarAsiento } from '../../utils/partida-doble';

/**
 * Lo que devuelve el diálogo.
 * `confirmar` = botón principal (registrar o enviar a aprobación, según permisos); si no, borrador.
 * `id` viene solo al corregir un asiento existente.
 */
export interface AsientoGuardado {
  asiento: NuevoAsiento;
  confirmar: boolean;
  id?: string;
}

/** Ventana para crear o corregir un asiento: cabecera, comprobante y líneas con control de cuadre. */
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
  protected readonly conta = inject(ContabilidadService);

  readonly visible = model(false);
  /** Asiento a corregir (borrador u observado). Sin él, el diálogo crea uno nuevo. */
  readonly inicial = input<Asiento | null>(null);
  /** Mientras el servidor guarda: bloquea los botones. */
  readonly guardando = input(false);
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
  protected readonly adjuntos = signal<Adjunto[]>([]);
  protected readonly subiendo = signal(false);
  protected readonly errores = signal<string[]>([]);
  protected readonly pesoLegible = pesoLegible;

  protected readonly suma = computed(() => totales(this.lineas()));

  constructor() {
    // Al abrir: carga el asiento a corregir o deja el formulario limpio
    effect(() => {
      if (!this.visible()) return;
      const a = untracked(() => this.inicial());
      this.fecha = a?.fecha ?? hoyLocal();
      this.glosa = a?.glosa ?? '';
      this.origen = a?.origen ?? 'diario';
      this.moneda.set(a?.moneda ?? 'PEN');
      this.tipoCambio = a?.tipoCambio ?? null;
      this.conDocumento = !!a?.documento;
      this.documento = {
        tipo: a?.documento?.tipo ?? '01',
        serie: a?.documento?.serie ?? '',
        numero: a?.documento?.numero ?? '',
        documentoTercero: a?.documento?.documentoTercero ?? '',
        nombreTercero: a?.documento?.nombreTercero ?? '',
      };
      this.lineas.set(a ? structuredClone(a.lineas) : [lineaVacia(), lineaVacia()]);
      this.adjuntos.set([...(a?.adjuntos ?? [])]);
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

  // ─── Adjuntos ─────────────────────────────────────────────────

  /** Valida y sube las fotos o PDF elegidos a la carpeta privada de la empresa. */
  protected async elegirArchivos(evento: Event) {
    const input = evento.target as HTMLInputElement;
    const archivos = Array.from(input.files ?? []);
    input.value = '';
    const problemas: string[] = [];

    this.subiendo.set(true);
    for (const archivo of archivos) {
      const problema = problemaArchivo(archivo, this.adjuntos().length);
      if (problema) {
        problemas.push(problema);
        continue;
      }
      try {
        const adjunto = await this.conta.subirAdjunto(archivo);
        this.adjuntos.update((lista) => [...lista, adjunto]);
      } catch (e) {
        problemas.push((e as Error).message);
      }
    }
    this.subiendo.set(false);
    this.errores.set(problemas);
  }

  protected verAdjunto(ruta: string) {
    this.conta.verAdjunto(ruta).catch((e: Error) => this.errores.set([e.message]));
  }

  protected quitarAdjunto(i: number) {
    this.adjuntos.update((lista) => lista.filter((_, j) => j !== i));
  }

  // ─── Guardar ──────────────────────────────────────────────────

  protected enviar(confirmar: boolean) {
    const asiento = this.armar();
    const errores = confirmar ? validarAsiento(asiento, this.conta.porCodigo) : this.minimos(asiento);
    this.errores.set(errores);
    if (errores.length === 0) this.guardar.emit({ asiento, confirmar, id: this.inicial()?.id });
  }

  private armar(): NuevoAsiento {
    return {
      fecha: this.fecha,
      glosa: this.glosa.trim(),
      origen: this.origen,
      moneda: this.moneda(),
      tipoCambio: this.moneda() === 'USD' ? (this.tipoCambio ?? undefined) : undefined,
      documento: this.conDocumento ? { ...this.documento } : undefined,
      adjuntos: this.adjuntos(),
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

/** Fecha de hoy en la hora de Perú (toISOString usa UTC y de noche da el día siguiente). */
function hoyLocal(): string {
  const d = new Date();
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}
