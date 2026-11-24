import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EmpresaActualService } from '../../../../core/empresa/services/empresa-actual.service';
import type { SaldoContable } from '../../../finanzas/models/finanzas.model';
import { FinanzasApi } from '../../../finanzas/services/finanzas-api.service';
import { FinanzasStore } from '../../../finanzas/services/finanzas-store.service';
import { dinero, hoy } from '../../../finanzas/utils/calculos';
import { descargarCsv } from '../../../finanzas/utils/csv';
import { EstadoSeccion } from '../../components/estado-seccion/estado-seccion';
import { estadoResultados } from '../../utils/estados';
import { fechaLarga, rangosRapidos } from '../../utils/periodos';

/** Estado de Resultados por naturaleza, desde los asientos registrados del Libro Diario. */
@Component({
  selector: 'app-resultados',
  imports: [FormsModule, RouterLink, EstadoSeccion],
  templateUrl: './resultados.html',
  styleUrl: '../../reportes.scss',
})
export class Resultados {
  private readonly api = inject(FinanzasApi);
  private readonly store = inject(FinanzasStore);
  protected readonly empresa = inject(EmpresaActualService);

  protected readonly rangos = rangosRapidos();
  protected readonly rango = signal('anio');
  protected readonly desde = signal(this.rangos[2].desde);
  protected readonly hasta = signal(hoy());
  protected readonly saldos = signal<SaldoContable[]>([]);
  protected readonly cargando = signal(false);

  protected readonly dinero = dinero;
  protected readonly fechaLarga = fechaLarga;
  protected readonly er = computed(() => estadoResultados(this.saldos()));

  constructor() {
    effect(() => {
      const d = this.desde();
      const h = this.hasta();
      this.empresa.id();
      untracked(() => void this.cargar(d, h));
    });
  }

  protected elegir(clave: string) {
    const r = this.rangos.find((x) => x.clave === clave);
    if (!r) return;
    this.rango.set(clave);
    this.desde.set(r.desde);
    this.hasta.set(r.hasta);
  }

  protected cambiarFecha(campo: 'desde' | 'hasta', valor: string) {
    if (!valor) return;
    this.rango.set('');
    this[campo].set(valor);
  }

  private async cargar(desde: string, hasta: string) {
    if (desde > hasta) return;
    this.cargando.set(true);
    try {
      this.saldos.set(await this.api.saldosContables(hasta, desde));
    } catch (e) {
      this.store.error('No se pudo cargar el reporte', e);
    } finally {
      this.cargando.set(false);
    }
  }

  protected imprimir() {
    window.print();
  }

  protected exportar() {
    const er = this.er();
    const filas: Record<string, unknown>[] = [];
    for (const s of [er.ingresos, er.gastos, er.financieros]) {
      for (const r of s.renglones) filas.push({ Sección: s.nombre, Concepto: r.nombre, Importe: r.monto });
      filas.push({ Sección: s.nombre, Concepto: `Total ${s.nombre.toLowerCase()}`, Importe: s.total });
    }
    filas.push({ Sección: '', Concepto: 'Resultado antes de impuestos', Importe: er.antesImpuestos });
    filas.push({ Sección: '', Concepto: 'Impuesto a la renta', Importe: er.impuestoRenta });
    filas.push({ Sección: '', Concepto: 'Resultado neto del periodo', Importe: er.resultadoNeto });
    descargarCsv(filas, `estado-resultados-${this.desde()}-a-${this.hasta()}.csv`);
  }
}
