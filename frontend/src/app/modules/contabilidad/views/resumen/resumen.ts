import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TagModule } from 'primeng/tag';
import { Contador } from '../../../../shared/components/contador/contador';
import { ActividadLista } from '../../components/actividad-lista/actividad-lista';
import { nombreOrigen } from '../../data/sunat';
import { ESTADOS } from '../../data/textos';
import { CorrelativoPipe, ImportePipe, PeriodoPipe } from '../../pipes/formato.pipes';
import { ContabilidadService } from '../../services/contabilidad.service';
import { saldo, totales } from '../../utils/partida-doble';

interface Indicador {
  clave: string;
  titulo: string;
  valor: number;
  icono: string;
  ayuda: string;
  /** Color del ícono de la tarjeta. */
  color: string;
  ruta: string;
}

/** Resumen del periodo: indicadores, pendientes del cierre y últimos asientos. Todo sale de los asientos reales. */
@Component({
  selector: 'app-resumen',
  imports: [RouterLink, TagModule, Contador, ActividadLista, ImportePipe, PeriodoPipe, CorrelativoPipe],
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
      { clave: 'ing', titulo: 'Ingresos del mes', valor: ingresos, icono: 'pi pi-arrow-up-right', ayuda: 'Cuentas 70 a 77', color: '#10b981', ruta: '/contabilidad/diario' },
      { clave: 'gas', titulo: 'Gastos del mes', valor: gastos, icono: 'pi pi-arrow-down-left', ayuda: 'Cuentas 60 a 68', color: '#f59e0b', ruta: '/contabilidad/diario' },
      {
        clave: 'res',
        titulo: resultado >= 0 ? 'Utilidad del mes' : 'Pérdida del mes',
        valor: Math.abs(resultado),
        icono: 'pi pi-chart-line',
        ayuda: 'Ingresos − gastos (antes de impuestos)',
        color: resultado >= 0 ? '#6366f1' : '#ef4444',
        ruta: '/reportes',
      },
      { clave: 'efe', titulo: 'Efectivo y bancos', valor: saldo(a, '10', 'deudora'), icono: 'pi pi-wallet', ayuda: 'Cuenta 10', color: '#06b6d4', ruta: '/contabilidad/mayor' },
      {
        clave: 'igv',
        titulo: igv >= 0 ? 'IGV por pagar' : 'Crédito fiscal a favor',
        valor: Math.abs(igv),
        icono: 'pi pi-percentage',
        ayuda: 'Cuenta 40111 · PDT 621',
        color: '#3b82f6',
        ruta: '/reportes/tributario',
      },
      { clave: 'det', titulo: 'Detracciones (B. Nación)', valor: saldo(a, '1042', 'deudora'), icono: 'pi pi-lock', ayuda: 'Cuenta 1042 · solo para tributos', color: '#64748b', ruta: '/contabilidad/mayor' },
    ];
  });

  /**
   * Lista de cierre del mes: lo hecho se marca solo según los datos.
   * Sin asientos registrados nada cuenta como hecho (un mes vacío empieza en 0 %).
   */
  protected readonly cierre = computed(() => {
    const hayMovimiento = this.registrados().length > 0;
    return [
      { texto: 'Registrar compras y ventas del mes', hecho: hayMovimiento },
      { texto: 'Registrar o eliminar los borradores', hecho: hayMovimiento && this.borradores().length === 0 },
      { texto: 'Aprobar lo que envió el contador', hecho: hayMovimiento && this.conta.porAprobar().length === 0 },
      { texto: 'Revisar que el Balance de comprobación cuadre', hecho: false },
      { texto: 'Asientos de destino (clase 6 → 9 y 79)', hecho: false },
      { texto: 'Generar los libros electrónicos (PLE / SIRE)', hecho: false },
    ];
  });

  protected readonly avanceCierre = computed(() => {
    const lista = this.cierre();
    return Math.round((lista.filter((c) => c.hecho).length / lista.length) * 100);
  });
}
