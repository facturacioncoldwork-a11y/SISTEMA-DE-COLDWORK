import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
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
import { ESTADOS, mensajeGuardado } from '../../data/textos';
import type { Asiento, EstadoAsiento } from '../../models/contabilidad.model';
import { CorrelativoPipe, ImportePipe, PeriodoPipe } from '../../pipes/formato.pipes';
import { ContabilidadService } from '../../services/contabilidad.service';
import { totales } from '../../utils/partida-doble';
import { puedeEditar } from '../../utils/permisos';

type Filtro = EstadoAsiento | 'todos';

/** Libro Diario (formato 5.1): asientos del periodo con sus líneas, filtros y acciones. */
@Component({
  selector: 'app-libro-diario',
  imports: [
    FormsModule,
    RouterLink,
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
  private readonly confirmacion = inject(ConfirmationService);

  protected readonly nombreOrigen = nombreOrigen;
  protected readonly nombreComprobante = nombreComprobante;
  protected readonly totales = totales;
  protected readonly estados = ESTADOS;

  protected readonly dialogoVisible = signal(false);
  protected readonly editando = signal<Asiento | null>(null);
  protected readonly guardando = signal(false);
  protected readonly busqueda = signal('');
  protected readonly filtro = signal<Filtro>('todos');

  protected readonly filtros = [
    { etiqueta: 'Todos', valor: 'todos' },
    { etiqueta: 'Registrados', valor: 'registrado' },
    { etiqueta: 'Por aprobar', valor: 'por_aprobar' },
    { etiqueta: 'Observados', valor: 'observado' },
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

  protected editable(a: Asiento): boolean {
    return puedeEditar(a, this.conta.persona());
  }

  protected nuevo() {
    this.editando.set(null);
    this.dialogoVisible.set(true);
  }

  protected editar(a: Asiento) {
    this.editando.set(a);
    this.dialogoVisible.set(true);
  }

  protected async guardar({ asiento, confirmar, id }: AsientoGuardado) {
    this.guardando.set(true);
    await this.intentar(async () => {
      const guardado = id
        ? await this.conta.actualizar(id, asiento, confirmar)
        : await this.conta.crear(asiento, confirmar);
      this.conta.periodo.set(guardado.periodo);
      this.dialogoVisible.set(false);
      this.avisos.add({ severity: 'success', summary: mensajeGuardado(guardado), life: 3500 });
    });
    this.guardando.set(false);
  }

  /** Borrador → registrado (si tiene permiso) o enviado al dueño. */
  protected confirmar(a: Asiento) {
    void this.intentar(async () => {
      if (this.conta.permisos().registrar) await this.conta.registrar(a.id);
      else await this.conta.enviar(a.id);
      this.avisos.add({ severity: 'success', summary: mensajeGuardado(this.conta.buscar(a.id)), life: 3500 });
    });
  }

  protected eliminar(a: Asiento) {
    this.confirmacion.confirm({
      header: 'Eliminar borrador',
      message: `Se eliminará el borrador "${a.glosa}".`,
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => void this.intentar(() => this.conta.eliminarBorrador(a.id)),
    });
  }

  protected anular(a: Asiento) {
    this.confirmacion.confirm({
      header: `Anular asiento ${a.numero}`,
      message:
        'El asiento queda en el libro como anulado (no se borra, para no romper el correlativo). ' +
        'Si solo hay que corregir un importe, es mejor registrar un asiento de ajuste.',
      acceptLabel: 'Anular',
      rejectLabel: 'Cancelar',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => void this.intentar(() => this.conta.anular(a.id)),
    });
  }

  private async intentar(accion: () => Promise<unknown>) {
    try {
      await accion();
    } catch (e) {
      this.avisos.add({ severity: 'error', summary: 'No se pudo completar', detail: (e as Error).message, life: 6000 });
    }
  }
}