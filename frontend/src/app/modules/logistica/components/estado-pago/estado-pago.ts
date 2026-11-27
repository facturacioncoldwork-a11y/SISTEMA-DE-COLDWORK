import { DatePipe } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EmpresaActualService } from '../../../../core/empresa/services/empresa-actual.service';
import {
  estadoCuota,
  formaDePago,
  formatoMonto,
  ordinalPago,
  textoAlLlegar,
  tocaPagarPorLlegada,
  ESTADOS_CUOTA,
} from '../../models/pagos';
import { hoyISO } from '../../models/plazos';
import { PagosService } from '../../services/pagos.service';

/**
 * Cómo va el pago de una orden de compra: "50 % pagado · falta US$ 6 460" o "Llegó: toca pagar".
 * SOLO el CEO: para cualquier otro rol no se dibuja nada (y la API de pagos tampoco le responde).
 * `detalle` muestra además la forma de pago y cada cuota (para el detalle de la OC).
 */
@Component({
  selector: 'app-estado-pago',
  imports: [DatePipe, RouterLink],
  templateUrl: './estado-pago.html',
  styleUrl: './estado-pago.scss',
})
export class EstadoPago {
  readonly ordenId = input.required<string>();
  readonly detalle = input(false);

  private readonly empresa = inject(EmpresaActualService);
  private readonly pagos = inject(PagosService);

  protected readonly hoy = hoyISO();
  protected readonly estados = ESTADOS_CUOTA;
  protected readonly ordinal = ordinalPago;
  protected readonly alLlegar = textoAlLlegar;
  protected readonly monto = formatoMonto;

  protected readonly orden = computed(() =>
    this.empresa.esDueno() && this.pagos.cargado()
      ? (this.pagos.ordenes().find((o) => o.id === this.ordenId()) ?? null)
      : null,
  );

  protected readonly info = computed(() => {
    const o = this.orden();
    if (!o) return null;
    const falta = Math.round((o.pendiente + o.sinPlan) * 100) / 100;
    const pct = o.total ? Math.min(100, Math.round((o.pagado / o.total) * 100)) : 0;
    const toca = o.pagos.some((p) => tocaPagarPorLlegada(o, p, this.hoy));
    const vencido = o.pagos.some((p) => estadoCuota(p, this.hoy) === 'vencido');
    let texto: string;
    let color: string;
    let icono: string;
    if (falta <= 0) {
      [texto, color, icono] = ['Pagado', '#059669', 'pi pi-check-circle'];
    } else if (toca) {
      [texto, color, icono] = [
        `Llegó: toca pagar ${formatoMonto(falta, o.moneda)}`,
        '#ea580c',
        'pi pi-bell',
      ];
    } else if (!o.pagos.length) {
      [texto, color, icono] = ['Sin plan de pagos', '#d97706', 'pi pi-wallet'];
    } else {
      [texto, color, icono] = [
        `${pct} % pagado · falta ${formatoMonto(falta, o.moneda)}`,
        vencido ? '#dc2626' : '#2563eb',
        vencido ? 'pi pi-exclamation-triangle' : 'pi pi-wallet',
      ];
    }
    return { o, texto, color, icono, pct, falta, forma: formaDePago(o) };
  });

  protected estadoDe(p: { vence: string; pagadoEn: string | null }) {
    return estadoCuota(p, this.hoy);
  }
}
