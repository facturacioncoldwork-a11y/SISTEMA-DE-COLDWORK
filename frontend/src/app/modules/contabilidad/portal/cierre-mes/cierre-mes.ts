import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProgressBarModule } from 'primeng/progressbar';
import { ImportePipe, PeriodoPipe } from '../../pipes/formato.pipes';
import { ContabilidadService } from '../../services/contabilidad.service';
import { balanceComprobacion, saldo } from '../../utils/partida-doble';
import { pendientesDe } from '../../utils/permisos';

interface Paso {
  texto: string;
  detalle: string;
  hecho: boolean;
  /** A dónde ir para resolverlo. */
  ruta?: string;
}

/** Lista de cierre del mes del contador: se marca sola según los datos. */
@Component({
  selector: 'app-cierre-mes',
  imports: [RouterLink, ProgressBarModule, ImportePipe, PeriodoPipe],
  templateUrl: './cierre-mes.html',
  styleUrl: './cierre-mes.scss',
})
export class CierreMes {
  protected readonly conta = inject(ContabilidadService);

  /** IGV del mes: positivo = por pagar; negativo = crédito fiscal a favor. */
  protected readonly igv = computed(() => saldo(this.conta.asientos(), '40111', 'acreedora'));

  protected readonly pasos = computed<Paso[]>(() => {
    const asientos = this.conta.asientos();
    const mios = pendientesDe(asientos, this.conta.persona());
    const sinSustento = asientos.filter(
      (a) => a.documento && a.estado !== 'anulado' && !(a.adjuntos?.length),
    ).length;
    const balance = balanceComprobacion(asientos, this.conta.porCodigo);
    const debe = balance.reduce((s, f) => s + f.sumaDebe, 0);
    const haber = balance.reduce((s, f) => s + f.sumaHaber, 0);

    return [
      {
        texto: 'Corregir lo observado por el dueño',
        detalle: mios.observados.length ? `${mios.observados.length} pendiente(s)` : 'Nada por corregir',
        hecho: mios.observados.length === 0,
        ruta: '/trabajo',
      },
      {
        texto: 'Enviar o eliminar los borradores',
        detalle: mios.borradores.length ? `${mios.borradores.length} borrador(es)` : 'Sin borradores',
        hecho: mios.borradores.length === 0,
        ruta: '/trabajo',
      },
      {
        texto: 'Esperar la aprobación del dueño',
        detalle: mios.enRevision.length ? `${mios.enRevision.length} en revisión` : 'Todo aprobado',
        hecho: mios.enRevision.length === 0,
      },
      {
        texto: 'Adjuntar el comprobante de cada operación',
        detalle: sinSustento ? `${sinSustento} asiento(s) sin foto o PDF` : 'Todos tienen sustento',
        hecho: sinSustento === 0,
        ruta: '/trabajo/mis-asientos',
      },
      {
        texto: 'Revisar que el Balance de comprobación cuadre',
        detalle: Math.abs(debe - haber) < 0.005 ? 'Cuadra' : 'No cuadra',
        hecho: Math.abs(debe - haber) < 0.005,
        ruta: this.conta.permisos().verLibros ? '/trabajo/balance' : undefined,
      },
    ];
  });

  protected readonly avance = computed(() => {
    const lista = this.pasos();
    return Math.round((lista.filter((p) => p.hecho).length / lista.length) * 100);
  });
}
