import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { PeriodoPipe } from '../../pipes/formato.pipes';
import { ContabilidadService } from '../../services/contabilidad.service';

interface Pestana {
  etiqueta: string;
  icono: string;
  ruta: string;
}

/** Marco del módulo: título, periodo contable y pestañas (Resumen, Diario, Mayor…). */
@Component({
  selector: 'app-contabilidad-layout',
  imports: [FormsModule, RouterOutlet, RouterLink, RouterLinkActive, MessageModule, SelectModule, PeriodoPipe],
  templateUrl: './contabilidad-layout.html',
  styleUrl: './contabilidad-layout.scss',
})
export class ContabilidadLayout {
  protected readonly conta = inject(ContabilidadService);

  protected readonly pestanas: Pestana[] = [
    { etiqueta: 'Resumen', icono: 'pi pi-th-large', ruta: '/contabilidad' },
    { etiqueta: 'Libro Diario', icono: 'pi pi-book', ruta: '/contabilidad/diario' },
    { etiqueta: 'Libro Mayor', icono: 'pi pi-list', ruta: '/contabilidad/mayor' },
    { etiqueta: 'Balance de comprobación', icono: 'pi pi-calculator', ruta: '/contabilidad/balance' },
    { etiqueta: 'Plan de cuentas', icono: 'pi pi-sitemap', ruta: '/contabilidad/plan-cuentas' },
    { etiqueta: 'Libros SUNAT', icono: 'pi pi-file-export', ruta: '/contabilidad/libros-sunat' },
  ];
}
