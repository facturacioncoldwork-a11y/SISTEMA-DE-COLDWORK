import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { EmpresaActualService } from '../../../../core/empresa/services/empresa-actual.service';
import { NOMBRE_ROL, nombreArea, veTodo, type Rol } from '../../../../core/permisos/areas';
import { AccesoDialogo, type DatosAcceso } from '../../components/acceso-dialogo/acceso-dialogo';
import type { Invitacion, Miembro, RolAsignable } from '../../models/equipo.model';
import { EquipoService } from '../../services/equipo.service';

/** Vista: equipo de la empresa y a qué áreas entra cada persona. Solo el dueño (CEO). */
@Component({
  selector: 'app-equipo',
  imports: [DatePipe, ButtonModule, ConfirmDialogModule, TableModule, TagModule, TooltipModule, AccesoDialogo],
  providers: [ConfirmationService],
  templateUrl: './equipo.html',
  styleUrl: './equipo.scss',
})
export class Equipo implements OnInit {
  private readonly api = inject(EquipoService);
  private readonly auth = inject(AuthService);
  private readonly empresa = inject(EmpresaActualService);
  private readonly avisos = inject(MessageService);
  private readonly confirmar = inject(ConfirmationService);

  protected readonly miembros = signal<Miembro[]>([]);
  protected readonly invitaciones = signal<Invitacion[]>([]);
  protected readonly cargando = signal(true);

  // Diálogo
  protected readonly dialogoVisible = signal(false);
  protected readonly modo = signal<'invitar' | 'editar'>('invitar');
  protected readonly inicial = signal<Partial<DatosAcceso> | null>(null);
  protected readonly guardando = signal(false);
  protected readonly errorDialogo = signal<string | null>(null);
  private editando: Miembro | null = null;

  protected readonly soyDueno = computed(() => this.empresa.rol() === 'dueno');
  protected readonly miId = computed(() => this.auth.usuario()?.id);
  protected readonly nombreArea = nombreArea;
  protected readonly veTodo = veTodo;

  ngOnInit() {
    void this.cargar();
  }

  async cargar() {
    this.cargando.set(true);
    try {
      const r = await this.api.listar();
      this.miembros.set(r.miembros);
      this.invitaciones.set(r.invitaciones);
    } catch (e) {
      this.avisar('error', 'No se pudo cargar el equipo', e);
    } finally {
      this.cargando.set(false);
    }
  }

  /** ¿Puedo editar o quitar a esta persona? (no a mí mismo, no al dueño; admin no toca admins) */
  protected editable(m: Miembro): boolean {
    if (m.usuarioId === this.miId() || m.rol === 'dueno') return false;
    return this.soyDueno() || m.rol !== 'admin';
  }

  protected rolTexto(rol: Rol): string {
    return NOMBRE_ROL[rol] ?? rol;
  }

  protected severidadRol(rol: Rol): 'contrast' | 'info' | 'secondary' {
    return rol === 'dueno' ? 'contrast' : rol === 'admin' ? 'info' : 'secondary';
  }

  protected abrirInvitar() {
    this.editando = null;
    this.modo.set('invitar');
    this.inicial.set({ rol: 'trabajador', areas: [] });
    this.errorDialogo.set(null);
    this.dialogoVisible.set(true);
  }

  protected abrirEditar(m: Miembro) {
    this.editando = m;
    this.modo.set('editar');
    this.inicial.set({ correo: m.correo, nombre: m.nombre, rol: m.rol as RolAsignable, areas: m.areas });
    this.errorDialogo.set(null);
    this.dialogoVisible.set(true);
  }

  protected async guardar(d: DatosAcceso) {
    this.guardando.set(true);
    this.errorDialogo.set(null);
    try {
      if (this.editando) {
        await this.api.actualizarMiembro(this.editando.usuarioId, { rol: d.rol, areas: d.areas });
        this.avisos.add({ severity: 'success', summary: 'Acceso actualizado', life: 3000 });
      } else {
        await this.api.invitar({ correo: d.correo, nombre: d.nombre || undefined, rol: d.rol, areas: d.areas });
        this.avisos.add({
          severity: 'success',
          summary: 'Invitación lista',
          detail: `Dile a ${d.correo} que cree su cuenta o entre con Google usando ese correo.`,
          life: 7000,
        });
      }
      this.dialogoVisible.set(false);
      await this.cargar();
    } catch (e) {
      this.errorDialogo.set(mensaje(e, 'No se pudo guardar.'));
    } finally {
      this.guardando.set(false);
    }
  }

  protected cambiarActivo(m: Miembro) {
    const bloquear = m.activo;
    this.confirmar.confirm({
      header: bloquear ? 'Bloquear acceso' : 'Reactivar acceso',
      message: bloquear
        ? `${m.nombre || m.correo} ya no podrá entrar a la empresa. Puedes reactivarlo cuando quieras.`
        : `${m.nombre || m.correo} podrá volver a entrar con sus mismas áreas.`,
      acceptLabel: bloquear ? 'Bloquear' : 'Reactivar',
      rejectLabel: 'Cancelar',
      acceptButtonProps: { severity: bloquear ? 'danger' : 'primary' },
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => this.ejecutar(() => this.api.actualizarMiembro(m.usuarioId, { activo: !bloquear })),
    });
  }

  protected quitar(m: Miembro) {
    this.confirmar.confirm({
      header: 'Quitar del equipo',
      message: `${m.nombre || m.correo} dejará de pertenecer a la empresa. Su cuenta no se borra.`,
      acceptLabel: 'Quitar',
      rejectLabel: 'Cancelar',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => this.ejecutar(() => this.api.quitarMiembro(m.usuarioId)),
    });
  }

  protected cancelarInvitacion(i: Invitacion) {
    void this.ejecutar(() => this.api.cancelarInvitacion(i.id));
  }

  private async ejecutar(accion: () => Promise<void>) {
    try {
      await accion();
      await this.cargar();
    } catch (e) {
      this.avisar('error', 'No se pudo completar', e);
    }
  }

  private avisar(severity: 'error' | 'warn', summary: string, e: unknown) {
    this.avisos.add({ severity, summary, detail: mensaje(e, ''), life: 6000 });
  }
}

function mensaje(e: unknown, porDefecto: string): string {
  const msg = (e as HttpErrorResponse)?.error?.message as string | string[] | undefined;
  return Array.isArray(msg) ? msg.join(' · ') : (msg ?? porDefecto);
}
