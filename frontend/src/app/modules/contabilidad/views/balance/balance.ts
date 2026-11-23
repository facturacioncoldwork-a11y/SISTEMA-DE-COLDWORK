import { Component, computed, inject } from '@angular/core';
import { MessageModule } from 'primeng/message';
import { ImportePipe, PeriodoPipe } from '../../pipes/formato.pipes';
import { ContabilidadService } from '../../services/contabilidad.service';
import { balanceComprobacion, redondear } from '../../utils/partida-doble';

/** Balance de Comprobación: sumas y saldos por cuenta. Debe cuadrar siempre. */
@Component({
  selector: 'app-balance',
  imports: [MessageModule, ImportePipe, PeriodoPipe],
  templateUrl: './balance.html',
  styleUrl: './balance.scss',
})
export class Balance {
  protected readonly conta = inject(ContabilidadService);

  protected readonly filas = computed(() => balanceComprobacion(this.conta.asientos(), this.conta.porCodigo));

  protected readonly total = computed(() => {
    const suma = (campo: 'sumaDebe' | 'sumaHaber' | 'saldoDeudor' | 'saldoAcreedor') =>
      redondear(this.filas().reduce((s, f) => s + f[campo], 0));
    return {
      sumaDebe: suma('sumaDebe'),
      sumaHaber: suma('sumaHaber'),
      saldoDeudor: suma('saldoDeudor'),
      saldoAcreedor: suma('saldoAcreedor'),
    };
  });

  protected readonly cuadra = computed(() => {
    const t = this.total();
    return t.sumaDebe === t.sumaHaber && t.saldoDeudor === t.saldoAcreedor;
  });
}
