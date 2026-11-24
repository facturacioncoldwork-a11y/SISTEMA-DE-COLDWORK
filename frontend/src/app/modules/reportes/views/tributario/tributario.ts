import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { InputNumberModule } from 'primeng/inputnumber';
import { EmpresaActualService } from '../../../../core/empresa/services/empresa-actual.service';
import type { Comprobante } from '../../../finanzas/models/finanzas.model';
import { FinanzasApi } from '../../../finanzas/services/finanzas-api.service';
import { FinanzasStore } from '../../../finanzas/services/finanzas-store.service';
import { dinero, hoy, redondear } from '../../../finanzas/utils/calculos';
import { resumenTributario } from '../../utils/estados';
import { ultimoDia } from '../../utils/periodos';

/** Coeficiente del pago a cuenta mensual de renta según el régimen (referencial). */
const REGIMENES = [
  { clave: 'rmt', nombre: 'MYPE Tributario', tasa: 1, nota: '1 % de los ingresos netos (hasta 300 UIT al año)' },
  { clave: 'general', nombre: 'Régimen General', tasa: 1.5, nota: '1.5 % o el coeficiente, el mayor' },
  { clave: 'rer', nombre: 'Régimen Especial', tasa: 1.5, nota: 'Cuota definitiva de 1.5 %' },
];

/** Resumen tributario del mes: base del PDT 621 (IGV y renta) y de las retenciones de 4.ª categoría. */
@Component({
  selector: 'app-tributario',
  imports: [FormsModule, RouterLink, InputNumberModule],
  templateUrl: './tributario.html',
  styleUrls: ['../../reportes.scss', './tributario.scss'],
})
export class Tributario {
  private readonly api = inject(FinanzasApi);
  private readonly store = inject(FinanzasStore);
  protected readonly empresa = inject(EmpresaActualService);

  protected readonly mes = signal(hoy().slice(0, 7));
  protected readonly comprobantes = signal<Comprobante[]>([]);
  protected readonly faltan = signal<string[]>([]);
  protected readonly cargando = signal(false);
  protected readonly regimenes = REGIMENES;
  protected readonly regimen = signal('rmt');
  protected readonly saldoAnterior = signal(0);
  protected readonly dinero = dinero;

  protected readonly r = computed(() => resumenTributario(this.comprobantes()));

  protected readonly calculo = computed(() => {
    const r = this.r();
    const reg = REGIMENES.find((x) => x.clave === this.regimen())!;
    const igvNeto = redondear(r.igvResultado - (this.saldoAnterior() || 0));
    const ingresosNetos = redondear(r.ventasGravadas + r.ventasNoGravadas);
    return {
      igvPagar: Math.max(igvNeto, 0),
      saldoFavor: Math.max(-igvNeto, 0),
      renta: Math.max(Math.round((ingresosNetos * reg.tasa) / 100), 0),
      ingresosNetos,
      regimen: reg,
    };
  });

  /** Vencimiento según el último dígito del RUC (cronograma SUNAT, día hábil aproximado). */
  protected readonly ultimoDigito = computed(() => this.empresa.actual()?.ruc?.slice(-1) ?? null);

  constructor() {
    effect(() => {
      const m = this.mes();
      this.empresa.id();
      untracked(() => void this.cargar(m));
    });
  }

  protected cambiarMes(valor: string) {
    if (valor) this.mes.set(valor);
  }

  private async cargar(mes: string) {
    const [a, m] = mes.split('-').map(Number);
    const desde = `${mes}-01`;
    const hasta = ultimoDia(a, m);
    this.cargando.set(true);
    // Ventas y compras pueden estar en áreas distintas: se muestra lo que la persona puede ver
    const [ventas, compras] = await Promise.allSettled([
      this.api.comprobantes('venta', desde, hasta),
      this.api.comprobantes('compra', desde, hasta),
    ]);
    const lista: Comprobante[] = [];
    const faltan: string[] = [];
    if (ventas.status === 'fulfilled') lista.push(...ventas.value);
    else faltan.push('ventas');
    if (compras.status === 'fulfilled') lista.push(...compras.value);
    else faltan.push('compras');
    if (faltan.length === 2) this.store.error('No se pudo cargar el resumen', (ventas as PromiseRejectedResult).reason);
    this.comprobantes.set(lista);
    this.faltan.set(faltan);
    this.cargando.set(false);
  }

  protected imprimir() {
    window.print();
  }
}
