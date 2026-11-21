import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SelectModule } from 'primeng/select';
import { Emoji } from '../../../../shared/components/emoji/emoji';
import { MenuCuenta } from '../../../../shared/components/menu-cuenta/menu-cuenta';
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
  imports: [
    FormsModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    SelectModule,
    Emoji,
    MenuCuenta,
    PeriodoPipe,
  ],
  templateUrl: './portal-layout.html',
  styleUrl: './portal-layout.scss',
})
export class PortalLayout {
  protected readonly conta = inject(ContabilidadService);

  protected readonly porCorregir = computed(
    () => pendientesDe(this.conta.asientos(), this.conta.persona()).observados.length,
  );

  protected readonly enlaces = computed<Enlace[]>(() => {
    const trabajo: Enlace[] = [
      { etiqueta: 'Mi trabajo', icono: 'pi pi-briefcase', ruta: '/trabajo', exacto: true },
      { etiqueta: 'Mis asientos', icono: 'pi pi-list-check', ruta: '/trabajo/mis-asientos' },
      { etiqueta: 'Cierre del mes', icono: 'pi pi-check-square', ruta: '/trabajo/cierre' },
    ];
    const libros: Enlace[] = this.conta.permisos().verLibros
      ? [
          { etiqueta: 'Diario', icono: 'pi pi-book', ruta: '/trabajo/diario' },
          { etiqueta: 'Mayor', icono: 'pi pi-list', ruta: '/trabajo/mayor' },
          { etiqueta: 'Balance', icono: 'pi pi-calculator', ruta: '/trabajo/balance' },
        ]
      : [];
    const consulta: Enlace[] = [
      { etiqueta: 'Plan de cuentas', icono: 'pi pi-sitemap', ruta: '/trabajo/plan-cuentas' },
      { etiqueta: 'SUNAT', icono: 'pi pi-file-export', ruta: '/trabajo/libros-sunat' },
    ];
    return [...trabajo, ...libros, ...consulta];
  });

  constructor() {
    usarAvisosEnVivo();
  }
}
