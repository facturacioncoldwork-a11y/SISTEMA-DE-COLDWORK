import { Component, computed, DestroyRef, effect, inject, OnInit, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CuentaDialogo } from '../../components/cuenta-dialogo/cuenta-dialogo';
import { MotivoDialogo } from '../../components/motivo-dialogo/motivo-dialogo';
import { MovimientoDialogo } from '../../components/movimiento-dialogo/movimiento-dialogo';
import { MEDIOS, TIPOS_CUENTA, TIPOS_MOVIMIENTO } from '../../data/finanzas';
import type { CuentaFinanciera, Movimiento, TipoMovimiento } from '../../models/finanzas.model';
import { FinanzasApi } from '../../services/finanzas-api.service';
import { FinanzasStore, mensajeError } from '../../services/finanzas-store.service';
import { dinero, hoy } from '../../utils/calculos';
import { descargarCsv } from '../../utils/csv';

/** Caja y bancos: saldos por cuenta y libro de movimientos (base del Libro Caja y Bancos, formato 1.1/1.2). */
@Component({
  selector: 'app-caja-bancos',
  imports: [FormsModule, RouterLink, CuentaDialogo, MotivoDialogo, MovimientoDialogo],
  templateUrl: './caja-bancos.html',
  styleUrl: './caja-bancos.scss',
})
export class CajaBancos implements OnInit {
  private readonly api = inject(FinanzasApi);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destruir = inject(DestroyRef);
  protected readonly store = inject(FinanzasStore);

  protected readonly dinero = dinero;
  protected readonly tiposMov = TIPOS_MOVIMIENTO;

  protected readonly filtroCuenta = signal<string | null>(null);
  protected readonly mes = signal(hoy().slice(0, 7));
  protected readonly texto = signal('');
  protected readonly lista = signal<Movimiento[]>([]);
  protected readonly cargando = signal(false);

  // Diálogos
  protected readonly dialogoCuenta = signal(false);
  protected readonly editando = signal<CuentaFinanciera | null>(null);
  protected readonly dialogoMov = signal(false);
  protected readonly tipoNuevo = signal<TipoMovimiento>('cobro');
  protected readonly cuentaNueva = signal<string | null>(null);
  protected readonly anulando = signal<Movimiento | null>(null);
  protected readonly ocupado = signal(false);
  protected readonly errorAnular = signal<string | null>(null);

  protected readonly cuentas = computed(() => this.store.cuentas());

  /** Totales en soles y dólares por separado (nunca se mezclan monedas). */
  protected readonly totales = computed(() => {
    const activas = this.store.cuentasActivas();
    const suma = (f: (c: CuentaFinanciera) => boolean) => activas.filter(f).reduce((s, c) => s + c.saldo, 0);
    return {
      soles: suma((c) => c.moneda === 'PEN' && c.tipo !== 'detracciones'),
      dolares: suma((c) => c.moneda === 'USD'),
      detracciones: suma((c) => c.tipo === 'detracciones'),
    };
  });

  protected readonly visibles = computed(() => {
    const t = this.texto().trim().toLowerCase();
    return this.lista().filter(
      (m) =>
        !t ||
        `${m.glosa ?? ''} ${m.terceroNombre ?? ''} ${m.comprobante ?? ''} ${m.referencia ?? ''} ${m.cuentaNombre}`
          .toLowerCase()
          .includes(t),
    );
  });

  /** Entradas y salidas del mes de la cuenta filtrada (solo si hay una cuenta elegida). */
  protected readonly flujo = computed(() => {
    const id = this.filtroCuenta();
    if (!id) return null;
    let entra = 0;
    let sale = 0;
    for (const m of this.lista()) {
      if (m.estado !== 'registrado') continue;
      if (this.esEntrada(m, id)) entra += m.monto;
      else sale += m.monto;
    }
    return { entra, sale };
  });

  constructor() {
    effect(() => {
      this.mes();
      this.filtroCuenta();
      untracked(() => void this.cargar());
    });
  }

  ngOnInit() {
    void this.store.asegurar();
    // ?nuevo=1 (o ?nuevo=pago, etc.) abre el formulario; se limpia para que no reaparezca al recargar
    this.ruta.queryParamMap.pipe(takeUntilDestroyed(this.destruir)).subscribe((q) => {
      const nuevo = q.get('nuevo');
      if (!nuevo) return;
      this.nuevoMovimiento(nuevo in TIPOS_MOVIMIENTO ? (nuevo as TipoMovimiento) : 'cobro');
      void this.router.navigate([], { relativeTo: this.ruta, queryParams: {}, replaceUrl: true });
    });
  }

  protected async cargar() {
    const [anio, mes] = this.mes().split('-').map(Number);
    const ultimo = new Date(anio, mes, 0).getDate();
    this.cargando.set(true);
    try {
      this.lista.set(
        await this.api.movimientos({
          cuenta: this.filtroCuenta() ?? undefined,
          desde: `${this.mes()}-01`,
          hasta: `${this.mes()}-${ultimo}`,
        }),
      );
    } catch (e) {
      this.store.error('No se pudieron cargar los movimientos', e);
    } finally {
      this.cargando.set(false);
    }
  }

  protected elegirCuenta(id: string) {
    this.filtroCuenta.update((actual) => (actual === id ? null : id));
  }

  protected nuevaCuenta() {
    this.editando.set(null);
    this.dialogoCuenta.set(true);
  }

  protected editarCuenta(c: CuentaFinanciera, ev: Event) {
    ev.stopPropagation();
    this.editando.set(c);
    this.dialogoCuenta.set(true);
  }

  protected nuevoMovimiento(tipo: TipoMovimiento, cuenta?: string) {
    this.tipoNuevo.set(tipo);
    this.cuentaNueva.set(cuenta ?? this.filtroCuenta());
    this.dialogoMov.set(true);
  }

  protected async cuentaGuardada() {
    this.store.ok('Cuenta guardada');
    await this.store.recargar();
  }

  protected async movimientoGuardado() {
    this.store.ok('Movimiento registrado', 'Su asiento ya está en el Libro Diario.');
    await Promise.all([this.cargar(), this.store.recargar()]);
  }

  protected async anular(motivo: string) {
    const m = this.anulando();
    if (!m) return;
    this.ocupado.set(true);
    this.errorAnular.set(null);
    try {
      await this.api.anularMovimiento(m.id, motivo);
      this.anulando.set(null);
      this.store.ok('Movimiento anulado', 'Su asiento quedó anulado en el Libro Diario.');
      await Promise.all([this.cargar(), this.store.recargar()]);
    } catch (e) {
      this.errorAnular.set(mensajeError(e) ?? 'No se pudo anular.');
    } finally {
      this.ocupado.set(false);
    }
  }

  /** ¿El movimiento suma a la cuenta indicada? (una transferencia suma en la de destino). */
  protected esEntrada(m: Movimiento, cuentaId?: string | null): boolean {
    if (m.tipo === 'transferencia') return !!cuentaId && m.cuentaDestinoId === cuentaId;
    return TIPOS_MOVIMIENTO[m.tipo].entra;
  }

  protected icono(c: CuentaFinanciera): string {
    return TIPOS_CUENTA.find((t) => t.valor === c.tipo)?.icono ?? 'pi pi-wallet';
  }

  protected detalle(m: Movimiento): string {
    if (m.tipo === 'transferencia') return `${m.cuentaNombre} → ${m.cuentaDestinoNombre ?? ''}`;
    if (m.comprobante) return `${m.comprobante} · ${m.terceroNombre ?? ''}`;
    return m.contrapartida ? `Cuenta ${m.contrapartida}` : '';
  }

  protected medio(m: Movimiento): string {
    return MEDIOS.find((x) => x.valor === m.medio)?.nombre ?? m.medio;
  }

  protected exportar() {
    const filas = this.lista().map((m) => ({
      Fecha: m.fecha,
      Cuenta: m.cuentaNombre,
      Tipo: TIPOS_MOVIMIENTO[m.tipo].nombre,
      Detalle: this.detalle(m),
      Glosa: m.glosa ?? '',
      Medio: this.medio(m),
      'N.° operación': m.referencia ?? '',
      Moneda: m.moneda,
      Entrada: this.esEntrada(m, this.filtroCuenta()) ? m.monto : '',
      Salida: this.esEntrada(m, this.filtroCuenta()) ? '' : m.monto,
      'Tipo de cambio': m.tipoCambio ?? '',
      Estado: m.estado,
    }));
    descargarCsv(filas, `caja-bancos-${this.mes()}.csv`);
  }
}
