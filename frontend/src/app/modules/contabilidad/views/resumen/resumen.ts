import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ActividadLista } from '../../components/actividad-lista/actividad-lista';
import { nombreOrigen } from '../../data/sunat';
import { ESTADOS } from '../../data/textos';
import { CorrelativoPipe, ImportePipe, PeriodoPipe } from '../../pipes/formato.pipes';
import { ContabilidadService } from '../../services/contabilidad.service';
import { saldo, totales } from '../../utils/partida-doble';

interface Indicador {
  titulo: string;
  valor: number;
  icono: string;
  ayuda: string;
  tono?: 'positivo' | 'negativo';
}

/** Resumen del periodo: indicadores, pendientes del cierre y últimos asientos. */
@Component({
  selector: 'app-resumen',
  imports: [RouterLink, ButtonModule, TagModule, ActividadLista, ImportePipe, PeriodoPipe, CorrelativoPipe],
  templateUrl: './resumen.html',
  styleUrl: './resumen.scss',
})
export class Resumen {
  protected readonly conta = inject(ContabilidadService);
  protected readonly nombreOrigen = nombreOrigen;
  protected readonly estados = ESTADOS;
  protected readonly totales = totales;

  protected readonly borradores = computed(() => this.conta.asientos().filter((a) => a.estado === 'borrador'));
  protected readonly registrados = computed(() => this.conta.asientos().filter((a) => a.estado === 'registrado'));
  protected readonly ultimos = computed(() => this.conta.asientos().slice(0, 5));

  protected readonly indicadores = computed<Indicador[]>(() => {
    const a = this.conta.asientos();
    const ingresos = saldo(a, '7', 'acreedora');
    const gastos = saldo(a, '6', 'deudora');
    const resultado = ingresos - gastos;
    const igv = saldo(a, '40111', 'acreedora');

    return [
      { titulo: 'Ingresos del mes', valor: ingresos, icono: 'pi pi-arrow-up-right', ayuda: 'Cuentas 70 a 77' },
      { titulo: 'Gastos del mes', valor: gastos, icono: 'pi pi-arrow-down-left', ayuda: 'Cuentas 60 a 68' },
      {
        titulo: resultado >= 0 ? 'Utilidad del mes' : 'Pérdida del mes',
        valor: Math.abs(resultado),
        icono: 'pi pi-chart-line',
        ayuda: 'Ingresos − gastos (antes de impuestos)',
        tono: resultado >= 0 ? 'positivo' : 'negativo',
      },
      { titulo: 'Efectivo y bancos', valor: saldo(a, '10', 'deudora'), icono: 'pi pi-wallet', ayuda: 'Cuenta 10' },
      {
        titulo: igv >= 0 ? 'IGV por pagar' : 'Crédito fiscal a favor',
        valor: Math.abs(igv),
        icono: 'pi pi-percentage',
        ayuda: 'Cuenta 40111 · se declara en el PDT 621',
      },
      {
        titulo: 'Detracciones (Banco de la Nación)',
        valor: saldo(a, '1042', 'deudora'),
        icono: 'pi pi-building',
        ayuda: 'Cuenta 1042 · solo para pagar tributos',
      },
    ];
  });

  /** Lista de cierre del mes: lo hecho se marca solo según los datos. */
  protected readonly cierre = computed(() => [
    { texto: 'Registrar compras y ventas del mes', hecho: this.registrados().length > 0 },
    { texto: 'Registrar o eliminar los borradores', hecho: this.borradores().length === 0 },
    { texto: 'Aprobar lo que envió el contador', hecho: this.conta.porAprobar().length === 0 },
    { texto: 'Revisar que el Balance de comprobación cuadre', hecho: false },
    { texto: 'Asientos de destino (clase 6 → 9 y 79)', hecho: false },
    { texto: 'Generar los libros electrónicos (PLE / SIRE)', hecho: false },
  ]);
}
