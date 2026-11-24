import { Component, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { CONTRAPARTIDAS, MEDIOS, TIPOS_MOVIMIENTO } from '../../data/finanzas';
import type { MedioPago, NuevoMovimiento, Pendiente, TipoMovimiento } from '../../models/finanzas.model';
import { FinanzasApi } from '../../services/finanzas-api.service';
import { FinanzasStore, mensajeError } from '../../services/finanzas-store.service';
import { dinero, hoy } from '../../utils/calculos';

/**
 * Registra un movimiento de caja o banco. Cada uno crea su asiento automático:
 * cobro (104/101 ← 1212), pago (4212/424 ← 104), ingreso/egreso con contrapartida
 * y transferencia entre cuentas propias.
 */
@Component({
  selector: 'app-movimiento-dialogo',
  imports: [FormsModule, DialogModule, InputNumberModule, InputTextModule, SelectModule],
  template: `
    <p-dialog [(visible)]="visible" [modal]="true" [draggable]="false" [style]="{ width: 'min(42rem, 96vw)' }" header="Registrar movimiento">
      <form class="lg-form" (ngSubmit)="guardar()">
        <div class="full tipos" role="radiogroup" aria-label="Tipo de movimiento">
          @for (t of tipos; track t.valor) {
            <button type="button" class="tipo" role="radio" [attr.aria-checked]="tipo() === t.valor" [class.on]="tipo() === t.valor" (click)="cambiarTipo(t.valor)">
              <i [class]="t.icono"></i><span>{{ t.nombre }}</span>
            </button>
          }
        </div>

        <div>
          <label for="mv-cta">{{ tipo() === 'transferencia' ? 'Sale de' : tipo() === 'cobro' || tipo() === 'ingreso' ? 'Entra a' : 'Sale de' }}</label>
          <p-select inputId="mv-cta" name="cta" [options]="cuentasOrigen()" optionLabel="etiqueta" optionValue="id" appendTo="body"
            placeholder="Elige la cuenta" [ngModel]="cuentaId()" (ngModelChange)="cuentaId.set($event)" />
        </div>
        <div>
          <label for="mv-fecha">Fecha</label>
          <input pInputText id="mv-fecha" name="fecha" type="date" [max]="hoy" [(ngModel)]="fecha" />
        </div>

        @switch (tipo()) {
          @case ('transferencia') {
            <div class="full">
              <label for="mv-dest">Entra a</label>
              <p-select inputId="mv-dest" name="dest" [options]="cuentasDestino()" optionLabel="etiqueta" optionValue="id" appendTo="body"
                placeholder="Cuenta de destino (misma moneda)" [ngModel]="destinoId()" (ngModelChange)="destinoId.set($event)" />
            </div>
          }
          @case ('ingreso') {
            <div class="full">
              <label for="mv-contra">Concepto (cuenta contable)</label>
              <p-select inputId="mv-contra" name="contra" [options]="contrapartidas()" optionLabel="etiqueta" optionValue="codigo" appendTo="body"
                [editable]="true" placeholder="Ej. 5011 Aporte de capital" [(ngModel)]="contrapartida" />
            </div>
          }
          @case ('egreso') {
            <div class="full">
              <label for="mv-contra">Concepto (cuenta contable)</label>
              <p-select inputId="mv-contra" name="contra" [options]="contrapartidas()" optionLabel="etiqueta" optionValue="codigo" appendTo="body"
                [editable]="true" placeholder="Ej. 40111 Pago de IGV" [(ngModel)]="contrapartida" />
            </div>
          }
          @default {
            <div class="full">
              <label for="mv-comp">{{ tipo() === 'cobro' ? 'Comprobante que te pagan' : 'Comprobante que pagas' }}</label>
              <p-select inputId="mv-comp" name="comp" [options]="opcionesComprobante()" optionLabel="etiqueta" optionValue="id" appendTo="body"
                [filter]="true" filterBy="etiqueta" [loading]="cargandoPendientes()"
                [placeholder]="opcionesComprobante().length ? 'Busca por número o nombre' : 'No hay comprobantes pendientes en esta moneda'"
                [ngModel]="comprobanteId()" (ngModelChange)="elegirComprobante($event)" />
              @if (comprobante(); as c) {
                <small class="ayuda">
                  Pendiente {{ dinero(c.pendiente, c.moneda) }}
                  @if (c.detraccionMonto > 0) {
                    · detracción S/ {{ c.detraccionMonto }} ({{ tipo() === 'cobro' ? 'el cliente la deposita en tu cuenta del Banco de la Nación' : 'deposítala en la cuenta BN del proveedor' }})
                  }
                </small>
              }
            </div>
          }
        }

        <div>
          <label for="mv-monto">Monto ({{ moneda() === 'USD' ? 'US$' : 'S/' }})</label>
          <p-inputnumber inputId="mv-monto" name="monto" [minFractionDigits]="2" [maxFractionDigits]="2" [min]="0" mode="decimal" locale="es-PE"
            [(ngModel)]="monto" />
        </div>
        @if (moneda() === 'USD') {
          <div>
            <label for="mv-tc">Tipo de cambio (SBS del día)</label>
            <p-inputnumber inputId="mv-tc" name="tc" [minFractionDigits]="3" [maxFractionDigits]="3" [min]="0" mode="decimal" [(ngModel)]="tipoCambio" />
          </div>
        }
        <div>
          <label for="mv-medio">Medio de pago</label>
          <p-select inputId="mv-medio" name="medio" [options]="medios" optionLabel="nombre" optionValue="valor" appendTo="body" [(ngModel)]="medio" />
        </div>
        <div>
          <label for="mv-ref">N.° de operación</label>
          <input pInputText id="mv-ref" name="ref" maxlength="60" placeholder="Del voucher o cheque" [(ngModel)]="referencia" />
        </div>
        <div class="full">
          <label for="mv-glosa">Glosa (opcional)</label>
          <input pInputText id="mv-glosa" name="glosa" maxlength="200" placeholder="Se completa sola si la dejas vacía" [(ngModel)]="glosa" />
        </div>

        @if (medio === 'efectivo' && monto && monto * (moneda() === 'USD' ? tipoCambio || 0 : 1) >= 2000) {
          <p class="full aviso">
            <i class="pi pi-info-circle"></i> Desde S/ 2,000 (o US$ 500) la Ley 28194 exige pagar por banco (bancarización) para no perder el gasto ni el crédito fiscal.
          </p>
        }
        @if (error(); as e) {
          <p class="error"><i class="pi pi-exclamation-circle"></i> {{ e }}</p>
        }
        <div class="full lg-pie-dialogo">
          <button type="button" class="lg-cta lg-cta--suave" (click)="visible.set(false)">Cancelar</button>
          <button type="submit" class="lg-cta" [disabled]="guardando()">
            <i [class]="guardando() ? 'pi pi-spin pi-spinner' : 'pi pi-check'"></i> Registrar
          </button>
        </div>
      </form>
    </p-dialog>
  `,
  styles: `
    .tipos { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 0.5rem; }
    @media (max-width: 640px) { .tipos { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    .tipo { display: flex; flex-direction: column; align-items: center; gap: 0.3rem; padding: 0.65rem 0.4rem;
      border: 1.5px solid var(--lg-line); border-radius: 0.8rem; background: #fff; cursor: pointer; font: inherit;
      font-size: 0.78rem; font-weight: 600; text-align: center; }
    .tipo i { font-size: 1.1rem; color: var(--lg-blue); }
    .tipo.on { border-color: var(--lg-blue); background: #eff6ff; }
    .ayuda { display: block; margin-top: 0.3rem; font-size: 0.78rem; color: var(--lg-muted); }
    .aviso { margin: 0; padding: 0.55rem 0.75rem; border-radius: 0.6rem; background: #fff7e6; color: #7a4b00; font-size: 0.84rem; }
  `,
})
export class MovimientoDialogo {
  private readonly api = inject(FinanzasApi);
  private readonly store = inject(FinanzasStore);

  readonly visible = model(false);
  /** Valores con los que abre (desde Cuentas por cobrar/pagar o una tarjeta de cuenta). */
  readonly tipoInicial = input<TipoMovimiento>('cobro');
  readonly cuentaInicial = input<string | null>(null);
  readonly comprobanteInicial = input<Pendiente | null>(null);
  readonly guardado = output<void>();

  protected readonly hoy = hoy();
  protected readonly dinero = dinero;
  protected readonly medios = MEDIOS;
  protected readonly tipos = (Object.keys(TIPOS_MOVIMIENTO) as TipoMovimiento[]).map((valor) => ({ valor, ...TIPOS_MOVIMIENTO[valor] }));

  protected readonly tipo = signal<TipoMovimiento>('cobro');
  protected readonly cuentaId = signal<string | null>(null);
  protected readonly destinoId = signal<string | null>(null);
  protected readonly comprobanteId = signal<string | null>(null);
  protected readonly pendientes = signal<Pendiente[]>([]);
  protected readonly cargandoPendientes = signal(false);
  protected fecha = hoy();
  protected monto: number | null = null;
  protected tipoCambio: number | null = null;
  protected medio: MedioPago = 'transferencia';
  protected referencia = '';
  protected glosa = '';
  protected contrapartida = '';
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);

  private readonly cuenta = computed(() => this.store.cuentasActivas().find((c) => c.id === this.cuentaId()) ?? null);
  protected readonly moneda = computed(() => this.cuenta()?.moneda ?? 'PEN');
  protected readonly comprobante = computed(() => this.pendientes().find((p) => p.id === this.comprobanteId()) ?? null);

  protected readonly cuentasOrigen = computed(() => {
    const t = this.tipo();
    return this.store
      .cuentasActivas()
      // Detracciones: recibe cobros e ingresos y paga tributos; no paga proveedores ni transfiere
      .filter((c) => c.tipo !== 'detracciones' || t === 'cobro' || t === 'ingreso' || t === 'egreso')
      .map((c) => ({ id: c.id, etiqueta: `${c.nombre} · ${dinero(c.saldo, c.moneda)}` }));
  });

  protected readonly cuentasDestino = computed(() => {
    const origen = this.cuenta();
    return this.store
      .cuentasActivas()
      .filter((c) => c.id !== origen?.id && (!origen || c.moneda === origen.moneda))
      .map((c) => ({ id: c.id, etiqueta: `${c.nombre} · ${dinero(c.saldo, c.moneda)}` }));
  });

  protected readonly contrapartidas = computed(() => {
    const t = this.tipo();
    const soloTributos = t === 'egreso' && this.cuenta()?.tipo === 'detracciones';
    return CONTRAPARTIDAS.filter((c) => c.para === t && (!soloTributos || c.codigo.startsWith('40'))).map((c) => ({
      codigo: c.codigo,
      etiqueta: `${c.codigo} · ${c.nombre}`,
    }));
  });

  /** Comprobantes pendientes de la misma moneda que la cuenta elegida. */
  protected readonly opcionesComprobante = computed(() =>
    this.pendientes()
      .filter((p) => !this.cuenta() || p.moneda === this.moneda())
      .map((p) => ({
        id: p.id,
        etiqueta: `${p.serie}-${p.numero} · ${p.terceroNombre} · ${dinero(p.pendiente, p.moneda)}`,
      })),
  );

  constructor() {
    // Al abrir: reinicia el formulario con los valores iniciales
    effect(() => {
      if (!this.visible()) return;
      const tipo = this.tipoInicial();
      const comp = this.comprobanteInicial();
      const cuenta = this.cuentaInicial();
      untracked(() => {
        this.tipo.set(tipo);
        this.destinoId.set(null);
        this.fecha = hoy();
        this.medio = 'transferencia';
        this.referencia = '';
        this.glosa = '';
        this.contrapartida = '';
        this.tipoCambio = comp?.tipoCambio ?? null;
        this.error.set(null);
        this.pendientes.set(comp ? [comp] : []);
        this.comprobanteId.set(comp?.id ?? null);
        this.monto = comp?.pendiente ?? null;
        this.cuentaId.set(cuenta ?? this.cuentaSugerida(comp?.moneda));
        void this.cargarPendientes();
      });
    });
  }

  protected cambiarTipo(tipo: TipoMovimiento) {
    if (tipo === this.tipo()) return;
    this.tipo.set(tipo);
    this.comprobanteId.set(null);
    this.contrapartida = '';
    this.error.set(null);
    if (!this.cuentasOrigen().some((c) => c.id === this.cuentaId())) this.cuentaId.set(this.cuentaSugerida());
    void this.cargarPendientes();
  }

  protected elegirComprobante(id: string | null) {
    this.comprobanteId.set(id);
    const c = this.comprobante();
    if (!c) return;
    this.monto = c.pendiente;
    if (c.tipoCambio) this.tipoCambio = c.tipoCambio;
    if (this.cuenta()?.moneda !== c.moneda) this.cuentaId.set(this.cuentaSugerida(c.moneda));
  }

  private cuentaSugerida(moneda?: string): string | null {
    const opciones = this.store.cuentasActivas().filter((c) => c.tipo !== 'detracciones' && (!moneda || c.moneda === moneda));
    return (opciones.find((c) => c.tipo === 'banco') ?? opciones[0])?.id ?? null;
  }

  private async cargarPendientes() {
    const t = this.tipo();
    if (t !== 'cobro' && t !== 'pago') return;
    this.cargandoPendientes.set(true);
    try {
      const lista = await this.api.pendientes(t === 'cobro' ? 'venta' : 'compra');
      if (this.tipo() === t) this.pendientes.set(lista);
    } catch (e) {
      this.error.set(mensajeError(e) ?? 'No se pudieron cargar los comprobantes pendientes.');
    } finally {
      this.cargandoPendientes.set(false);
    }
  }

  private validar(): string | null {
    const t = this.tipo();
    if (!this.cuentaId()) return 'Elige la cuenta de caja o banco.';
    if (!this.fecha) return 'Indica la fecha.';
    if (this.fecha > hoy()) return 'La fecha no puede ser futura.';
    if (!this.monto || this.monto <= 0) return 'Indica un monto mayor que cero.';
    if (this.moneda() === 'USD' && !(this.tipoCambio && this.tipoCambio > 0)) return 'Indica el tipo de cambio del día.';
    if ((t === 'cobro' || t === 'pago') && !this.comprobanteId()) return 'Elige el comprobante.';
    const c = this.comprobante();
    if (c && this.monto > c.pendiente + 0.005) return `El monto supera lo pendiente (${dinero(c.pendiente, c.moneda)}).`;
    if ((t === 'ingreso' || t === 'egreso') && !/^\d{2,8}$/.test(this.contrapartida.trim()))
      return 'Indica la cuenta contable de contrapartida (solo números, ej. 5011).';
    if (t === 'transferencia' && !this.destinoId()) return 'Elige la cuenta de destino.';
    const saldo = this.cuenta()?.saldo ?? 0;
    if (!TIPOS_MOVIMIENTO[t].entra && this.monto > saldo + 0.005) return `Saldo insuficiente (disponible ${dinero(saldo, this.moneda())}).`;
    return null;
  }

  protected async guardar() {
    const error = this.validar();
    if (error) return this.error.set(error);
    const t = this.tipo();
    const datos: NuevoMovimiento = {
      cuentaId: this.cuentaId()!,
      fecha: this.fecha,
      tipo: t,
      comprobanteId: t === 'cobro' || t === 'pago' ? this.comprobanteId()! : undefined,
      cuentaDestinoId: t === 'transferencia' ? this.destinoId()! : undefined,
      contrapartida: t === 'ingreso' || t === 'egreso' ? this.contrapartida.trim() : undefined,
      monto: this.monto!,
      tipoCambio: this.moneda() === 'USD' ? this.tipoCambio! : undefined,
      medio: this.medio,
      referencia: this.referencia.trim() || undefined,
      glosa: this.glosa.trim() || undefined,
    };
    this.guardando.set(true);
    this.error.set(null);
    try {
      await this.api.registrarMovimiento(datos);
      this.guardado.emit();
      this.visible.set(false);
    } catch (e) {
      this.error.set(mensajeError(e) ?? 'No se pudo registrar.');
    } finally {
      this.guardando.set(false);
    }
  }
}
