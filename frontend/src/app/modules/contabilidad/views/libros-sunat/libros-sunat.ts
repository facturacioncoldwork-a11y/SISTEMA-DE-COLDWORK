import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { librosObligatorios, REGIMENES, TRAMOS } from '../../data/sunat';
import { ContabilidadService } from '../../services/contabilidad.service';

/** Qué libros electrónicos debe llevar la empresa según su régimen e ingresos, y su estado. */
@Component({
  selector: 'app-libros-sunat',
  imports: [FormsModule, ButtonModule, SelectModule, TagModule, TooltipModule],
  templateUrl: './libros-sunat.html',
  styleUrl: './libros-sunat.scss',
})
export class LibrosSunat {
  protected readonly conta = inject(ContabilidadService);

  protected readonly regimenes = REGIMENES;
  protected readonly tramos = TRAMOS;

  protected readonly libros = computed(() => librosObligatorios(this.conta.regimen(), this.conta.tramo()));
  protected readonly contabilidadCompleta = computed(
    () => this.conta.regimen() !== 'rer' && this.conta.tramo() === 'mas1700',
  );
}
