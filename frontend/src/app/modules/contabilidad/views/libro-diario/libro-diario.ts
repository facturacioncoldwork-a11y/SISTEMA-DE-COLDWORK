import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { AsientoDialogo, type AsientoGuardado } from '../../components/asiento-dialogo/asiento-dialogo';
import { nombreComprobante, nombreOrigen } from '../../data/sunat';
import type { Asiento, EstadoAsiento } from '../../models/contabilidad.model';
import { CorrelativoPipe, ImportePipe, PeriodoPipe } from '../../pipes/formato.pipes';
import { ContabilidadService } from '../../services/contabilidad.service';
import { totales } from '../../utils/partida-doble';

type Filtro = EstadoAsiento | 'todos';

/** Libro Diario (formato 5.1): asientos del periodo con sus líneas, filtros y acciones. */
@Component({
  selector: 'app-libro-diario',
  imports: [
    FormsModule,
    ButtonModule,
    ConfirmDialogModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    SelectButtonModule,
    TagModule,
    TooltipModule,
    AsientoDialogo,
    CorrelativoPipe,
    ImportePipe,
    PeriodoPipe,
  ],
  providers: [ConfirmationService],
  templateUrl: './libro-diario.html',
  styleUrl: './libro-diario.scss',
})
export class LibroDiario {
  protected readonly conta = inject(ContabilidadService);
  private readonly avisos = inject(MessageService);
  private readonly confirmar = inject(ConfirmationService);

  protected readonly nombreOrigen = nombreOrigen;
  protected readonly nombreComprobante = nombreComprobante;
  protected readonly totales = totales;

  protected readonly dialogoVisible = signal(false);
  protected readonly busqueda = signal('');
  protected readonly filtro = signal<Filtro>('todos');

  protected readonly filtros = [
    { etiqueta: 'Todos', valor: 'todos' },
    { etiqueta: 'Registrados', valor: 'registrado' },
    { etiqueta: 'Borradores', valor: 'borrador' },
    { etiqueta: 'Anulados', valor: 'anulado' },
  ];

  protected readonly visibles = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    return this.conta.asientos().filter((a) => {
      if (this.filtro() !== 'todos' && a.estado !== this.filtro()) return false;
      if (!texto) return true;
      const doc = a.documento ? `${a.documento.serie}-${a.documento.numero} ${a.documento.nombreTercero ?? ''}` : '';
      return `${a.glosa} ${doc} ${a.lineas.map((l) => l.cuenta).join(' ')}`.toLowerCase().includes(texto);
    });
  });

  /** Totales del libro: solo asientos registrados. */
  protected readonly totalLibro = computed(() =>
    totales(this.conta.asientos().filter((a) => a.estado === 'registrado').flatMap((a) => a.lineas)),
  );

  // ─── Acciones ─────────────────────────────────────────────────

  protected guardar({ asiento, registrar }: AsientoGuardado) {
    this.intentar(() => {
      const nuevo = this.conta.crear(asiento, registrar);
      this.conta.periodo.set(nuevo.periodo);
      this.dialogoVisible.set(false);
      this.avisos.add({
        severity: 'success',
        summary: registrar ? `Asiento ${nuevo.numero} registrado` : 'Borrador guardado',
        life: 3000,
      });
    });
  }

  protected registrar(a: Asiento) {
    this.intentar(() => {
      this.conta.registrar(a.id);
      this.avisos.add({ severity: 'success', summary: `Asiento ${a.numero} registrado`, life: 3000 });
    });
  }

  protected eliminar(a: Asiento) {
    this.confirmar.confirm({
      header: 'Eliminar borrador',
      message: `Se eliminará el borrador "${a.glosa}".`,
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => this.intentar(() => this.conta.eliminarBorrador(a.id)),
    });
  }

  protected anular(a: Asiento) {
    this.confirmar.confirm({
      header: `Anular asiento ${a.numero}`,
      message:
        'El asiento queda en el libro como anulado (no se borra, para no romper el correlativo). ' +
        'Si solo hay que corregir un importe, es mejor registrar un asiento de ajuste.',
      acceptLabel: 'Anular',
      rejectLabel: 'Cancelar',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => this.intentar(() => this.conta.anular(a.id)),
    });
  }

  private intentar(accion: () => void) {
    try {
      accion();
    } catch (e) {
      this.avisos.add({ severity: 'error', summary: 'No se pudo completar', detail: (e as Error).message, life: 6000 });
    }
  }
}
