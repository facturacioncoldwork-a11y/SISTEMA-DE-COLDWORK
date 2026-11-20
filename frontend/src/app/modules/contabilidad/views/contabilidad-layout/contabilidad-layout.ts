import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MessageService } from 'primeng/api';
import { BadgeModule } from 'primeng/badge';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { CONTADORA } from '../../data/equipo-ejemplo';
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
  imports: [FormsModule, RouterOutlet, RouterLink, RouterLinkActive, BadgeModule, MessageModule, SelectModule, PeriodoPipe],
  templateUrl: './contabilidad-layout.html',
  styleUrl: './contabilidad-layout.scss',
})
export class ContabilidadLayout {
  protected readonly conta = inject(ContabilidadService);
  private readonly avisos = inject(MessageService);

  protected readonly contadora = CONTADORA;

  protected readonly pestanas: Pestana[] = [
    { etiqueta: 'Resumen', icono: 'pi pi-th-large', ruta: '/contabilidad' },
    { etiqueta: 'Aprobaciones', icono: 'pi pi-inbox', ruta: '/contabilidad/aprobaciones', conContador: true },
    { etiqueta: 'Libro Diario', icono: 'pi pi-book', ruta: '/contabilidad/diario' },
    { etiqueta: 'Libro Mayor', icono: 'pi pi-list', ruta: '/contabilidad/mayor' },
    { etiqueta: 'Balance de comprobación', icono: 'pi pi-calculator', ruta: '/contabilidad/balance' },
    { etiqueta: 'Plan de cuentas', icono: 'pi pi-sitemap', ruta: '/contabilidad/plan-cuentas' },
    { etiqueta: 'Libros SUNAT', icono: 'pi pi-file-export', ruta: '/contabilidad/libros-sunat' },
  ];

  constructor() {
    // SIMULACIÓN: dentro del ERP siempre se actúa como dueño
    this.conta.vista.set('dueno');
    usarAvisosEnVivo();
  }

  /** SIMULACIÓN: la contadora registra algo desde otra computadora. */
  protected simular() {
    this.avisos.add({ severity: 'secondary', summary: 'María está registrando una venta…', life: 2500 });
    setTimeout(() => this.conta.simularContadora(), 2500);
  }
}
