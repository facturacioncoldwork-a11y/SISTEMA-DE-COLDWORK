import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SelectModule } from 'primeng/select';
import { Emoji } from '../../../../shared/components/emoji/emoji';
import { PeriodoPipe } from '../../pipes/formato.pipes';
import { usarAvisosEnVivo } from '../../services/avisos-en-vivo';
import { ContabilidadService } from '../../services/contabilidad.service';

interface Pestana {
  etiqueta: string;
  icono: string;
  ruta: string;
  /** Muestra el número de asientos por aprobar. */
  conContador?: boolean;
}

/**
 * Marco del módulo para el DUEÑO (dentro del ERP): periodo, pestañas y supervisión.
 * El contador no entra aquí: tiene su propio portal en /trabajo.
 */
@Component({
  selector: 'app-contabilidad-layout',
  imports: [FormsModule, RouterOutlet, RouterLink, RouterLinkActive, SelectModule, Emoji, PeriodoPipe],
  templateUrl: './contabilidad-layout.html',
  styleUrl: './contabilidad-layout.scss',
})
export class ContabilidadLayout {
  protected readonly conta = inject(ContabilidadService);

  private readonly todas: Pestana[] = [
    { etiqueta: 'Resumen', icono: 'pi pi-th-large', ruta: '/contabilidad' },
    { etiqueta: 'Aprobaciones', icono: 'pi pi-inbox', ruta: '/contabilidad/aprobaciones', conContador: true },
    { etiqueta: 'Libro Diario', icono: 'pi pi-book', ruta: '/contabilidad/diario' },
    { etiqueta: 'Libro Mayor', icono: 'pi pi-list', ruta: '/contabilidad/mayor' },
    { etiqueta: 'Balance de comprobación', icono: 'pi pi-calculator', ruta: '/contabilidad/balance' },
    { etiqueta: 'Plan de cuentas', icono: 'pi pi-sitemap', ruta: '/contabilidad/plan-cuentas' },
    { etiqueta: 'Libros SUNAT', icono: 'pi pi-file-export', ruta: '/contabilidad/libros-sunat' },
  ];

  /** Aprobaciones solo para quien aprueba (dueño o admin). */
  protected readonly pestanas = computed(() =>
    this.todas.filter((p) => !p.conContador || this.conta.permisos().aprobar),
  );

  constructor() {
    usarAvisosEnVivo();
  }
}
