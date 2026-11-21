import { Component, computed, inject, signal } from '@angular/core';
import { MessageService } from 'primeng/api';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { EmpresaActualService } from '../../../../core/empresa/services/empresa-actual.service';
import { nombreArea, NOMBRE_ROL, veTodo, type Area } from '../../../../core/permisos/areas';
import { Emoji } from '../../../../shared/components/emoji/emoji';
import type { NombreIcono } from '../../../../shared/components/emoji/iconos';
import { Saludo } from '../../../../shared/components/saludo/saludo';
import { AsientoDialogo, type AsientoGuardado } from '../../components/asiento-dialogo/asiento-dialogo';
import { AsientoTarjeta } from '../../components/asiento-tarjeta/asiento-tarjeta';
import { mensajeGuardado } from '../../data/textos';
import type { Asiento } from '../../models/contabilidad.model';
import { PeriodoPipe } from '../../pipes/formato.pipes';
import { ContabilidadService } from '../../services/contabilidad.service';
import { pendientesDe } from '../../utils/permisos';

interface TarjetaArea {
  clave: string;
  nombre: string;
  sticker: NombreIcono;
  ruta: string;
  colores: [string, string];
  resumen: string;
}

/** Inicio del contador: lo que tiene que corregir, terminar o está esperando aprobación. */
@Component({
  selector: 'app-mi-trabajo',
  imports: [RouterLink, ButtonModule, Emoji, Saludo, AsientoDialogo, AsientoTarjeta, PeriodoPipe],
  templateUrl: './mi-trabajo.html',
  styleUrl: './mi-trabajo.scss',
})
export class MiTrabajo {
  protected readonly conta = inject(ContabilidadService);
  private readonly avisos = inject(MessageService);
  private readonly empresa = inject(EmpresaActualService);

  protected readonly pendientes = computed(() => pendientesDe(this.conta.asientos(), this.conta.persona()));

  protected readonly registrados = computed(
    () =>
      this.conta
        .asientos()
        .filter((a) => a.creadoPor === this.conta.persona().id && a.estado === 'registrado').length,
  );

  /** Empresa, rol y áreas de la cuenta (para el saludo). */
  protected readonly chips = computed(() => {
    const e = this.empresa.actual();
    if (!e) return [];
    const areas = veTodo(e.rol) ? 'todas las áreas' : e.areas.map(nombreArea).join(', ');
    return [e.razonSocial, NOMBRE_ROL[e.rol], `Ves: ${areas}`];
  });

  /** Una tarjeta por área contable de la persona, con lo pendiente de esa área. */
  protected readonly areas = computed<TarjetaArea[]>(() => {
    const p = this.pendientes();
    const e = this.empresa.actual();
    const tarjetas: TarjetaArea[] = [
      {
        clave: 'contabilidad',
        nombre: 'Contabilidad',
        sticker: 'libro',
        ruta: '/trabajo/mis-asientos',
        colores: ['#8b5cf6', '#d946ef'],
        resumen: `${p.observados.length} por corregir · ${p.borradores.length} borradores`,
      },
      {
        clave: 'finanzas',
        nombre: 'Finanzas',
        sticker: 'dinero',
        ruta: '/trabajo/cierre',
        colores: ['#34d399', '#059669'],
        resumen: 'Caja, bancos e impuestos del mes',
      },
    ];
    return tarjetas.filter((t) => !e || veTodo(e.rol) || e.areas.includes(t.clave as Area));
  });
  // Diálogo
  protected readonly dialogoVisible = signal(false);
  protected readonly editando = signal<Asiento | null>(null);

  protected nuevo() {
    this.editando.set(null);
    this.dialogoVisible.set(true);
  }

  protected corregir(a: Asiento) {
    this.editando.set(a);
    this.dialogoVisible.set(true);
  }

  protected guardar({ asiento, confirmar, id }: AsientoGuardado) {
    this.intentar(() => {
      const guardado = id ? this.conta.actualizar(id, asiento, confirmar) : this.conta.crear(asiento, confirmar);
      this.dialogoVisible.set(false);
      this.avisos.add({ severity: 'success', summary: mensajeGuardado(guardado), life: 3500 });
    });
  }

  protected enviar(a: Asiento) {
    this.intentar(() => {
      if (this.conta.permisos().registrar) this.conta.registrar(a.id);
      else this.conta.enviar(a.id);
      this.avisos.add({ severity: 'success', summary: mensajeGuardado(this.conta.buscar(a.id)), life: 3500 });
    });
  }

  protected eliminar(a: Asiento) {
    this.intentar(() => this.conta.eliminarBorrador(a.id));
  }

  private intentar(accion: () => void) {
    try {
      accion();
    } catch (e) {
      this.avisos.add({ severity: 'error', summary: 'No se pudo completar', detail: (e as Error).message, life: 6000 });
    }
  }
}
