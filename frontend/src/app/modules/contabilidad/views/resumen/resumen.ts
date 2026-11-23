import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { Contador } from '../../../../shared/components/contador/contador';
import { Emoji } from '../../../../shared/components/emoji/emoji';
import type { NombreIcono } from '../../../../shared/components/emoji/iconos';
import { ActividadLista } from '../../components/actividad-lista/actividad-lista';
import { nombreOrigen } from '../../data/sunat';
import { ESTADOS } from '../../data/textos';
import { CorrelativoPipe, ImportePipe, PeriodoPipe } from '../../pipes/formato.pipes';
import { ContabilidadService } from '../../services/contabilidad.service';
import { saldo, totales } from '../../utils/partida-doble';

interface Indicador {
  titulo: string;
  valor: number;
  sticker: NombreIcono;
  ayuda: string;
  /** Par de colores del degradado de la tarjeta. */
  colores: [string, string];
  ruta?: string;
}

/** Resumen del periodo: indicadores, pendientes del cierre y últimos asientos. */
@Component({
  selector: 'app-resumen',
  imports: [
    RouterLink,
    ButtonModule,
    TagModule,
    Contador,
    Emoji,
    ActividadLista,
    ImportePipe,
    PeriodoPipe,
    CorrelativoPipe,
  ],
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
      {
        titulo: 'Ingresos del mes',
        valor: ingresos,
        sticker: 'dinero',
        ayuda: 'Cuentas 70 a 77',
        colores: ['#34d399', '#059669'],
        ruta: '/contabilidad/diario',
      },
      {
        titulo: 'Gastos del mes',
        valor: gastos,
        sticker: 'caja',
        ayuda: 'Cuentas 60 a 68',
        colores: ['#fb923c', '#e11d48'],
        ruta: '/contabilidad/diario',
      },
      {
        titulo: resultado >= 0 ? 'Utilidad del mes' : 'Pérdida del mes',
        valor: Math.abs(resultado),
        sticker: resultado >= 0 ? 'estrella' : 'idea',
        ayuda: 'Ingresos − gastos (antes de impuestos)',
        colores: resultado >= 0 ? ['#a78bfa', '#7c3aed'] : ['#f87171', '#b91c1c'],
        ruta: '/contabilidad/balance',
      },
      {
        titulo: 'Efectivo y bancos',
        valor: saldo(a, '10', 'deudora'),
        sticker: 'edificio',
        ayuda: 'Cuenta 10',
        colores: ['#06b6d4', '#2563eb'],
        ruta: '/contabilidad/mayor',
      },
      {
        titulo: igv >= 0 ? 'IGV por pagar' : 'Crédito fiscal a favor',
        valor: Math.abs(igv),
        sticker: 'libro',
        ayuda: 'Cuenta 40111 · PDT 621',
        colores: ['#fbbf24', '#d97706'],
        ruta: '/contabilidad/libros-sunat',
      },
      {
        titulo: 'Detracciones (B. Nación)',
        valor: saldo(a, '1042', 'deudora'),
        sticker: 'grafico',
        ayuda: 'Cuenta 1042 · solo para tributos',
        colores: ['#f472b6', '#c026d3'],
        ruta: '/contabilidad/mayor',
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

  protected readonly avanceCierre = computed(() => {
    const lista = this.cierre();
    return Math.round((lista.filter((c) => c.hecho).length / lista.length) * 100);
  });
}
