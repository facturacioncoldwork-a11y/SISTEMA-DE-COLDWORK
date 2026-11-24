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
import { situacionFinanciera } from '../../utils/estados';
import { fechaLarga } from '../../utils/periodos';

/** Estado de Situación Financiera (balance general) a una fecha, con todo lo registrado hasta ese día. */
@Component({
  selector: 'app-situacion',
  imports: [FormsModule, RouterLink, EstadoSeccion],
  templateUrl: './situacion.html',
  styleUrl: '../../reportes.scss',
})
export class Situacion {
  private readonly api = inject(FinanzasApi);
  private readonly store = inject(FinanzasStore);
  protected readonly empresa = inject(EmpresaActualService);

  protected readonly al = signal(hoy());
  protected readonly saldos = signal<SaldoContable[]>([]);
  protected readonly cargando = signal(false);
  protected readonly dinero = dinero;
  protected readonly fechaLarga = fechaLarga;

  protected readonly sf = computed(() => situacionFinanciera(this.saldos()));

  constructor() {
    effect(() => {
      const al = this.al();
      this.empresa.id();
      untracked(() => void this.cargar(al));
    });
  }

  protected cambiar(valor: string) {
    if (valor) this.al.set(valor);
  }

  private async cargar(al: string) {
    this.cargando.set(true);
    try {
      this.saldos.set(await this.api.saldosContables(al));
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
    const sf = this.sf();
    const filas: Record<string, unknown>[] = [];
    for (const s of [sf.activoCorriente, sf.activoNoCorriente, sf.pasivoCorriente, sf.pasivoNoCorriente, sf.patrimonio]) {
      for (const r of s.renglones) filas.push({ Sección: s.nombre, Concepto: r.nombre, Importe: r.monto });
      filas.push({ Sección: s.nombre, Concepto: `Total ${s.nombre.toLowerCase()}`, Importe: s.total });
    }
    filas.push({ Sección: '', Concepto: 'Total activo', Importe: sf.totalActivo });
    filas.push({ Sección: '', Concepto: 'Total pasivo y patrimonio', Importe: sf.totalPasivoPatrimonio });
    descargarCsv(filas, `situacion-financiera-al-${this.al()}.csv`);
  }
}
