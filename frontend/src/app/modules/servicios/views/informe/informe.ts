import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { map } from 'rxjs';
import { EmpresaActualService } from '../../../../core/empresa/services/empresa-actual.service';
import { Firma } from '../../components/firma/firma';
import { ATS, ESTADOS_ORDEN, MEDICIONES, PRIORIDADES, TIPOS_SERVICIO } from '../../data/catalogos';
import type { Foto, Informe } from '../../models/servicios.model';
import { ServiciosSim } from '../../services/servicios-sim.service';

/**
 * Informe técnico de campo. El técnico lo llena en el celular durante el servicio:
 * ATS → diagnóstico y mediciones → trabajos y repuestos → fotos → firma del cliente.
 * Se imprime o guarda en PDF con el formato de la empresa.
 */
@Component({
  selector: 'app-informe-tecnico',
  imports: [FormsModule, RouterLink, Firma],
  templateUrl: './informe.html',
  styleUrl: './informe.scss',
})
export class InformeTecnico {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly avisos = inject(MessageService);
  protected readonly sim = inject(ServiciosSim);
  protected readonly empresa = inject(EmpresaActualService);

  protected readonly ats = ATS;
  protected readonly mediciones = MEDICIONES;
  protected readonly estados = ESTADOS_ORDEN;
  protected readonly prioridades = PRIORIDADES;
  protected readonly tipos = TIPOS_SERVICIO;

  private readonly id = toSignal(this.ruta.paramMap.pipe(map((p) => p.get('id') ?? '')), { initialValue: '' });
  protected readonly orden = computed(() => this.sim.orden(this.id()));
  protected readonly cliente = computed(() => this.sim.cliente(this.orden()?.clienteId ?? ''));
  protected readonly equipo = computed(() => this.sim.equipo(this.orden()?.equipoId ?? ''));
  protected readonly inf = computed(() => this.orden()?.informe);
  protected readonly cerrada = computed(() => this.orden()?.estado === 'cerrada');

  protected readonly atsCompleto = computed(() => ATS.every((a) => this.inf()?.ats[a.clave]));
  protected readonly nuevoRepuesto = signal({ descripcion: '', cantidad: 1, unidad: 'UND' });

  /** Avance del informe (para la barra): qué secciones ya tienen datos. */
  protected readonly avance = computed(() => {
    const i = this.inf();
    if (!i) return 0;
    const partes = [
      this.atsCompleto(),
      i.mediciones.some((m) => m.valor !== null),
      !!i.diagnostico.trim(),
      !!i.trabajos.trim(),
      i.fotos.length > 0,
      i.equipoOperativo !== null,
      !!i.firmaCliente || !!i.firmaNombre,
    ];
    return Math.round((partes.filter(Boolean).length / partes.length) * 100);
  });

  protected unidad(clave: string) {
    return MEDICIONES.find((m) => m.clave === clave)?.unidad ?? '';
  }
  protected nombreMedicion(clave: string) {
    return MEDICIONES.find((m) => m.clave === clave)?.nombre ?? clave;
  }

  protected cambiar(cambios: Partial<Informe>) {
    const o = this.orden();
    if (o && !this.cerrada()) this.sim.actualizarInforme(o.id, cambios);
  }

  protected marcarAts(clave: string, valor: boolean) {
    this.cambiar({ ats: { ...this.inf()!.ats, [clave]: valor } });
  }

  protected medir(clave: string, valor: number | null) {
    this.cambiar({ mediciones: this.inf()!.mediciones.map((m) => (m.clave === clave ? { ...m, valor } : m)) });
  }

  protected agregarRepuesto() {
    const r = this.nuevoRepuesto();
    if (!r.descripcion.trim() || r.cantidad <= 0) return;
    this.cambiar({ repuestos: [...this.inf()!.repuestos, { ...r, descripcion: r.descripcion.trim() }] });
    this.nuevoRepuesto.set({ descripcion: '', cantidad: 1, unidad: 'UND' });
  }

  protected quitarRepuesto(i: number) {
    this.cambiar({ repuestos: this.inf()!.repuestos.filter((_, j) => j !== i) });
  }

  /** Fotos desde la cámara del celular o la galería (en la simulación quedan solo en este navegador). */
  protected subirFotos(ev: Event, etapa: Foto['etapa']) {
    const archivos = Array.from((ev.target as HTMLInputElement).files ?? []).filter((f) => f.type.startsWith('image/'));
    const nuevas = archivos.slice(0, 6).map((f) => ({ id: crypto.randomUUID(), etapa, url: URL.createObjectURL(f), nota: '' }));
    this.cambiar({ fotos: [...this.inf()!.fotos, ...nuevas] });
    (ev.target as HTMLInputElement).value = '';
  }

  protected quitarFoto(id: string) {
    this.cambiar({ fotos: this.inf()!.fotos.filter((f) => f.id !== id) });
  }

  protected fotosDe(etapa: Foto['etapa']) {
    return this.inf()?.fotos.filter((f) => f.etapa === etapa) ?? [];
  }

  protected empezar() {
    const o = this.orden();
    if (!o) return;
    if (!this.atsCompleto()) {
      this.avisos.add({ severity: 'warn', summary: 'Primero el ATS', detail: 'Marca todo el Análisis de Trabajo Seguro antes de empezar.', life: 4500 });
      return;
    }
    this.sim.actualizar(o.id, { estado: 'en_curso' });
    this.cambiar({ inicio: new Date().toISOString().slice(0, 16) });
  }

  protected terminar() {
    const o = this.orden();
    const i = this.inf();
    if (!o || !i) return;
    if (!i.trabajos.trim() || i.equipoOperativo === null) {
      this.avisos.add({ severity: 'warn', summary: 'Falta completar', detail: 'Describe el trabajo realizado e indica si el equipo queda operativo.', life: 4500 });
      return;
    }
    this.sim.actualizar(o.id, { estado: 'por_firmar' });
    this.cambiar({ fin: new Date().toISOString().slice(0, 16) });
  }

  protected cerrar() {
    const o = this.orden();
    const i = this.inf();
    if (!o || !i) return;
    if (!i.firmaCliente || !i.firmaNombre?.trim()) {
      this.avisos.add({ severity: 'warn', summary: 'Falta la conformidad', detail: 'El cliente debe firmar y escribir su nombre.', life: 4500 });
      return;
    }
    this.sim.actualizar(o.id, { estado: 'cerrada' });
    this.avisos.add({ severity: 'success', summary: `${o.numero} cerrada`, detail: 'El informe quedó firmado. En la versión real se envía al cliente por correo.', life: 4500 });
  }

  protected imprimir() {
    window.print();
  }

  protected volver() {
    void this.router.navigateByUrl('/servicios');
  }

  protected horas(i: Informe): string {
    if (!i.inicio || !i.fin) return '—';
    const min = Math.max(0, (Date.parse(i.fin) - Date.parse(i.inicio)) / 60000);
    return `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, '0')} min`;
  }

  protected iniciales(id: string) {
    return (this.sim.tecnico(id)?.nombre ?? '?').split(' ').map((p) => p[0]).slice(0, 2).join('');
  }
}
