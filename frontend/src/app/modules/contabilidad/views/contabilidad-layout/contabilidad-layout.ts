import { Component, computed, effect, inject, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MessageService } from 'primeng/api';
import { BadgeModule } from 'primeng/badge';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { CONTADORA, nombrePersona } from '../../data/equipo-ejemplo';
import { ACCIONES } from '../../data/textos';
import type { RolContable } from '../../models/contabilidad.model';
import { PeriodoPipe } from '../../pipes/formato.pipes';
import { ContabilidadService } from '../../services/contabilidad.service';

interface Pestana {
  etiqueta: string;
  icono: string;
  ruta: string;
  /** Solo para quien puede aprobar (el dueño). */
  soloDueno?: boolean;
}

/**
 * Marco del módulo: título, periodo, pestañas y el selector "Ver como" de la simulación.
 * El dueño y el contador ven pestañas distintas sobre los mismos datos.
 */
@Component({
  selector: 'app-contabilidad-layout',
  imports: [
    FormsModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    BadgeModule,
    MessageModule,
    SelectModule,
    SelectButtonModule,
    PeriodoPipe,
  ],
  templateUrl: './contabilidad-layout.html',
  styleUrl: './contabilidad-layout.scss',
})
export class ContabilidadLayout {
  protected readonly conta = inject(ContabilidadService);
  private readonly router = inject(Router);
  private readonly avisos = inject(MessageService);

  protected readonly contadora = CONTADORA;
  protected readonly vistas = [
    { etiqueta: 'Dueño', valor: 'dueno', icono: 'pi pi-crown' },
    { etiqueta: 'Contador', valor: 'contador', icono: 'pi pi-calculator' },
  ];

  private readonly todas: Pestana[] = [
    { etiqueta: 'Resumen', icono: 'pi pi-th-large', ruta: '/contabilidad' },
    { etiqueta: 'Aprobaciones', icono: 'pi pi-inbox', ruta: '/contabilidad/aprobaciones', soloDueno: true },
    { etiqueta: 'Libro Diario', icono: 'pi pi-book', ruta: '/contabilidad/diario' },
    { etiqueta: 'Libro Mayor', icono: 'pi pi-list', ruta: '/contabilidad/mayor' },
    { etiqueta: 'Balance de comprobación', icono: 'pi pi-calculator', ruta: '/contabilidad/balance' },
    { etiqueta: 'Plan de cuentas', icono: 'pi pi-sitemap', ruta: '/contabilidad/plan-cuentas' },
    { etiqueta: 'Libros SUNAT', icono: 'pi pi-file-export', ruta: '/contabilidad/libros-sunat' },
  ];

  protected readonly pestanas = computed(() => {
    const dueno = this.conta.permisos().aprobar;
    return this.todas
      .filter((p) => dueno || !p.soloDueno)
      .map((p) => (p.ruta === '/contabilidad' && !dueno ? { ...p, etiqueta: 'Mi trabajo', icono: 'pi pi-briefcase' } : p));
  });

  constructor() {
    // Aviso "en vivo" cuando otra persona hace algo (luego llegará por Supabase Realtime)
    let vistas = 0;
    effect(() => {
      const ultima = this.conta.actividad()[0];
      const yo = untracked(() => this.conta.persona());
      if (vistas++ === 0 || !ultima || ultima.personaId === yo.id) return;
      this.avisos.add({
        severity: 'info',
        icon: 'pi pi-bell',
        summary: `${nombrePersona(ultima.personaId)} ${ACCIONES[ultima.accion].texto}`,
        detail: `Asiento ${String(ultima.numero).padStart(4, '0')} · ${ultima.glosa}`,
        life: 6000,
      });
    });
  }

  /** Cambia de vista (simulación) y vuelve al inicio del módulo. */
  protected cambiarVista(vista: RolContable) {
    this.conta.vista.set(vista);
    void this.router.navigateByUrl('/contabilidad');
  }

  /** Simula que la contadora registra algo desde otra computadora. */
  protected simular() {
    this.avisos.add({ severity: 'secondary', summary: 'María está registrando una venta…', life: 2500 });
    setTimeout(() => this.conta.simularContadora(), 2500);
  }
}
