import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MessageService } from 'primeng/api';
import { SelectModule } from 'primeng/select';
import { Emoji } from '../../../../shared/components/emoji/emoji';
import { PeriodoPipe } from '../../pipes/formato.pipes';
import { usarAvisosEnVivo } from '../../services/avisos-en-vivo';
import { ContabilidadService } from '../../services/contabilidad.service';
import { pendientesDe } from '../../utils/permisos';

interface Enlace {
  etiqueta: string;
  icono: string;
  ruta: string;
  exacto?: boolean;
}

/**
 * Marco del portal del contador: barra superior propia y navegación corta.
 * Nada del ERP del dueño: ni menú lateral, ni otros módulos, ni indicadores de la empresa.
 */
@Component({
  selector: 'app-portal-layout',
  imports: [FormsModule, RouterOutlet, RouterLink, RouterLinkActive, SelectModule, Emoji, PeriodoPipe],
  templateUrl: './portal-layout.html',
  styleUrl: './portal-layout.scss',
})
export class PortalLayout {
  protected readonly conta = inject(ContabilidadService);
  private readonly router = inject(Router);
  private readonly avisos = inject(MessageService);

  protected readonly porCorregir = computed(
    () => pendientesDe(this.conta.asientos(), this.conta.persona()).observados.length,
  );

  protected readonly enlaces = computed<Enlace[]>(() => {
    const base: Enlace[] = [
      { etiqueta: 'Mi trabajo', icono: 'pi pi-briefcase', ruta: '/trabajo', exacto: true },
      { etiqueta: 'Mis asientos', icono: 'pi pi-list-check', ruta: '/trabajo/mis-asientos' },
      { etiqueta: 'Plan de cuentas', icono: 'pi pi-sitemap', ruta: '/trabajo/plan-cuentas' },
    ];
    if (!this.conta.permisos().verLibros) return base;
    return [
      ...base,
      { etiqueta: 'Diario', icono: 'pi pi-book', ruta: '/trabajo/diario' },
      { etiqueta: 'Mayor', icono: 'pi pi-list', ruta: '/trabajo/mayor' },
      { etiqueta: 'Balance', icono: 'pi pi-calculator', ruta: '/trabajo/balance' },
    ];
  });

  constructor() {
    usarAvisosEnVivo();
  }

  /** SIMULACIÓN: el dueño revisa lo enviado desde su computadora. */
  protected simularDueno() {
    if (!this.conta.porAprobar().length) {
      this.avisos.add({ severity: 'secondary', summary: 'No tienes asientos enviados al dueño.', life: 3000 });
      return;
    }
    this.avisos.add({ severity: 'secondary', summary: 'El dueño está revisando…', life: 2500 });
    setTimeout(() => this.conta.simularDueno(), 2500);
  }

  /** SIMULACIÓN: volver a la vista del dueño. */
  protected salir() {
    void this.router.navigateByUrl('/contabilidad');
  }
}
