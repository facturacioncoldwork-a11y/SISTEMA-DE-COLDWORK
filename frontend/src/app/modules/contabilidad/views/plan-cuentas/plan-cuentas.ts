import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { ELEMENTOS } from '../../data/pcge';
import { ContabilidadService } from '../../services/contabilidad.service';

/** Plan de cuentas (PCGE 2019) con búsqueda y filtro por elemento. */
@Component({
  selector: 'app-plan-cuentas',
  imports: [FormsModule, IconFieldModule, InputIconModule, InputTextModule, TagModule],
  templateUrl: './plan-cuentas.html',
  styleUrl: './plan-cuentas.scss',
})
export class PlanCuentas {
  private readonly conta = inject(ContabilidadService);

  protected readonly elementos = ELEMENTOS;
  protected readonly elemento = signal<number | null>(null);
  protected readonly busqueda = signal('');

  protected readonly visibles = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    return this.conta.cuentas.filter(
      (c) =>
        (this.elemento() === null || c.elemento === this.elemento()) &&
        (!texto || c.codigo.startsWith(texto) || c.nombre.toLowerCase().includes(texto)),
    );
  });

  protected nombreElemento(numero: number): string {
    return ELEMENTOS.find((e) => e.numero === numero)?.nombre ?? '';
  }

  protected alternarElemento(numero: number) {
    this.elemento.update((actual) => (actual === numero ? null : numero));
  }
}
