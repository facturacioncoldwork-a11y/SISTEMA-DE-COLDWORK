import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { CorrelativoPipe, ImportePipe, PeriodoPipe } from '../../pipes/formato.pipes';
import { ContabilidadService } from '../../services/contabilidad.service';
import { mayorDeCuenta, totales, vigentes } from '../../utils/partida-doble';

/** Libro Mayor (formato 6.1): movimientos de una cuenta con su saldo acumulado. */
@Component({
  selector: 'app-libro-mayor',
  imports: [FormsModule, SelectModule, CorrelativoPipe, ImportePipe, PeriodoPipe],
  templateUrl: './libro-mayor.html',
  styleUrl: './libro-mayor.scss',
})
export class LibroMayor {
  protected readonly conta = inject(ContabilidadService);

  /** Solo se ofrecen las cuentas (y sus padres) que tienen movimientos en el periodo. */
  protected readonly opciones = computed(() => {
    const usadas = new Set(vigentes(this.conta.asientos()).flatMap((a) => a.lineas.map((l) => l.cuenta)));
    return this.conta.cuentas
      .filter((c) => [...usadas].some((u) => u.startsWith(c.codigo)))
      .map((c) => ({ ...c, etiqueta: `${c.codigo} · ${c.nombre}` }));
  });

  protected readonly codigo = signal('10');
  protected readonly cuenta = computed(() => this.conta.porCodigo.get(this.codigo()));

  protected readonly movimientos = computed(() => {
    const c = this.cuenta();
    return c ? mayorDeCuenta(this.conta.asientos(), c) : [];
  });

  protected readonly suma = computed(() => totales(this.movimientos().map((m) => ({ cuenta: '', ...m }))));
  protected readonly saldoFinal = computed(() => this.movimientos().at(-1)?.saldo ?? 0);
}
