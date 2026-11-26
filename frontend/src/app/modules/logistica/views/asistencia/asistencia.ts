import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, effect, ElementRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { mensajeError } from '../../../../core/api/errores';
import { hoy } from '../../../finanzas/utils/calculos';
import type { Justificacion } from '../../../personal/models/personal.model';
import { AsistenciaApi } from '../../../personal/services/asistencia-api.service';
import { AsistenciaStore } from '../../../personal/services/asistencia-store.service';
import { aHoras } from '../../../personal/utils/horas';
import { DatosEmpresa } from '../../../servicios/services/datos-empresa.service';
import {
  diaDe,
  diasDelMes,
  ESTADOS,
  iniciales,
  JUSTIFICACIONES,
  totalesDe,
  type DiaPersona,
  type EstadoDia,
} from '../../models/asistencia-equipo';
import { LogisticaStore } from '../../services/logistica-store.service';

interface Persona {
  id: string;
  nombre: string;
  cargo: string;
  campo: boolean;
}

type Equipo = 'logistica' | 'todos';

const MOTIVOS = ['Olvidó marcar', 'Celular sin batería', 'Sin señal en la obra', 'Llegó conmigo'];

/**
 * Vista: ASISTENCIA del equipo de almacén (solo el CEO).
 * Usa los mismos datos de Personal → Asistencia: cada trabajador marca con su celular o la tablet;
 * aquí el CEO ve quién llegó, registra una marca manual con motivo, justifica faltas y aprueba
 * marcas sin GPS. Las marcas no se editan ni se borran (DS 004-2006-TR).
 */
@Component({
  selector: 'app-asistencia-logistica',
  imports: [DatePipe, FormsModule, RouterLink, DialogModule, TooltipModule],
  templateUrl: './asistencia.html',
  styleUrl: './asistencia.scss',
})
export class AsistenciaLogistica {
  protected readonly asis = inject(AsistenciaStore);
  private readonly api = inject(AsistenciaApi);
  private readonly datos = inject(DatosEmpresa);
  private readonly avisos = inject(LogisticaStore);

  protected readonly estados = ESTADOS;
  protected readonly leyenda: EstadoDia[] = [
    'puntual',
    'tarde',
    'pendiente',
    'justificado',
    'falta',
    'descanso',
  ];
  protected readonly justificaciones = Object.entries(JUSTIFICACIONES).map(([clave, j]) => ({
    clave: clave as Justificacion,
    ...j,
  }));
  protected readonly motivos = MOTIVOS;
  protected readonly iniciales = iniciales;
  protected readonly aHoras = aHoras;

  protected readonly hoy = signal(hoy());
  private readonly ahoraMin = signal(minutosAhora());
  protected readonly fecha = signal(hoy());
  protected readonly equipo = signal<Equipo>('logistica');
  protected readonly texto = signal('');

  // Diálogos
  protected readonly manualPara = signal<Persona | null>(null);
  protected readonly motivo = signal('');
  protected readonly justificarPara = signal<Persona | null>(null);
  protected readonly tipo = signal<Justificacion>('permiso');
  protected readonly sustento = signal('');
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    // La tira de días se desliza sola hasta el día elegido (hoy, al entrar)
    effect(() => {
      this.fecha();
      setTimeout(() =>
        this.host.nativeElement
          .querySelector('.dia.on')
          ?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }),
      );
    });
    // El reloj avanza: "aún no llega" pasa a "falta" sin recargar
    const reloj = setInterval(() => {
      this.ahoraMin.set(minutosAhora());
      this.hoy.set(hoy());
    }, 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(reloj));
  }

  /** Equipo de almacén: quien tiene el área Logística (sin el dueño); "Todos": todo el personal. */
  protected readonly personas = computed<Persona[]>(() => {
    const t = this.texto().trim().toLowerCase();
    return this.datos
      .activos()
      .filter((m) =>
        this.equipo() === 'todos' ? true : m.rol !== 'dueno' && m.areas.includes('logistica'),
      )
      .map((m) => ({
        id: m.usuarioId,
        nombre: m.nombre || 'Sin nombre',
        cargo: m.areas.includes('tecnica')
          ? 'Área técnica'
          : m.rol === 'dueno'
            ? 'Dueño'
            : m.areas.includes('logistica')
              ? 'Almacén y logística'
              : 'Personal',
        campo: m.areas.includes('tecnica'),
      }))
      .filter((p) => !t || p.nombre.toLowerCase().includes(t))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  });

  protected readonly dias = computed(() => diasDelMes(this.hoy()));
  protected readonly esHoy = computed(() => this.fecha() === this.hoy());

  /** Estado de cada persona en cada día del mes (una sola pasada). */
  private readonly mapa = computed(() => {
    const m = new Map<string, DiaPersona>();
    const marcas = this.asis.marcas();
    const ausencias = this.asis.ausencias();
    const h = this.asis.horario();
    for (const p of this.personas())
      for (const d of this.dias())
        m.set(`${p.id}|${d}`, diaDe(p.id, d, marcas, ausencias, h, this.hoy(), this.ahoraMin()));
    return m;
  });

  protected dia(p: Persona, fecha = this.fecha()): DiaPersona {
    return (
      this.mapa().get(`${p.id}|${fecha}`) ??
      diaDe(p.id, fecha, [], [], this.asis.horario(), this.hoy(), this.ahoraMin())
    );
  }

  /** Resumen del día elegido. */
  protected readonly delDia = computed(() => {
    const ds = this.personas().map((p) => this.dia(p));
    const t = totalesDe(ds);
    const esperados = ds.filter((d) => d.estado !== 'descanso' && d.estado !== 'futuro').length;
    return {
      ...t,
      porLlegar: ds.filter((d) => d.estado === 'por_llegar').length,
      pendientes: ds.filter((d) => d.estado === 'pendiente').length,
      trabajando: ds.filter((d) => d.trabajando).length,
      porcentaje: esperados ? Math.round((t.asistencias / esperados) * 100) : 0,
    };
  });

  protected totalesMes(p: Persona) {
    return totalesDe(this.dias().map((d) => this.dia(p, d)));
  }

  protected numero(fecha: string) {
    return Number(fecha.slice(8));
  }
  protected inicialDia(fecha: string) {
    return ['D', 'L', 'M', 'M', 'J', 'V', 'S'][new Date(`${fecha}T12:00:00`).getDay()];
  }

  protected ayudaCelda(p: Persona, fecha: string): string {
    const d = this.dia(p, fecha);
    const base = `${p.nombre} · ${this.numero(fecha)}: ${this.textoEstado(d)}`;
    if (d.marca?.entrada)
      return `${base} · ${d.marca.entrada}${d.marca.salida ? '–' + d.marca.salida : ''}`;
    return base;
  }

  protected textoEstado(d: DiaPersona): string {
    if (d.estado === 'justificado' && d.ausencia) return JUSTIFICACIONES[d.ausencia.tipo].nombre;
    if (d.estado === 'tarde') return `Tardanza de ${duracion(d.tardanza)}`;
    return ESTADOS[d.estado].nombre;
  }

  protected color(e: EstadoDia) {
    return ESTADOS[e].color;
  }

  protected async recargar() {
    await this.asis.recargar();
  }

  // ─── Marca manual (solo hoy: la hora la pone el servidor) ─────────
  protected abrirManual(p: Persona) {
    this.manualPara.set(p);
    this.motivo.set('');
    this.error.set(null);
  }

  protected async registrarManual() {
    const p = this.manualPara();
    if (!p) return;
    if (this.motivo().trim().length < 5) {
      this.error.set('Escribe el motivo (mínimo 5 letras): queda en el registro.');
      return;
    }
    this.guardando.set(true);
    this.error.set(null);
    try {
      const r = await this.asis.marcarManual(p.id, this.motivo().trim());
      this.avisos.ok(
        r.accion === 'entrada' ? 'Entrada registrada' : 'Salida registrada',
        `${p.nombre} · ${r.hora}`,
      );
      this.manualPara.set(null);
    } catch (e) {
      this.error.set(mensajeError(e) ?? 'No se pudo registrar');
    } finally {
      this.guardando.set(false);
    }
  }

  // ─── Justificar ausencia (cualquier día del mes) ──────────────────
  protected abrirJustificar(p: Persona) {
    this.justificarPara.set(p);
    this.tipo.set('permiso');
    this.sustento.set('');
    this.error.set(null);
  }

  protected async justificar() {
    const p = this.justificarPara();
    if (!p) return;
    this.guardando.set(true);
    this.error.set(null);
    try {
      await this.api.registrarAusencia(
        p.id,
        this.fecha(),
        this.tipo(),
        this.sustento().trim() || undefined,
      );
      await this.asis.recargar();
      this.avisos.ok(
        'Ausencia justificada',
        `${p.nombre} · ${JUSTIFICACIONES[this.tipo()].nombre}`,
      );
      this.justificarPara.set(null);
    } catch (e) {
      this.error.set(mensajeError(e) ?? 'No se pudo justificar');
    } finally {
      this.guardando.set(false);
    }
  }

  protected async aprobar(p: Persona) {
    const m = this.dia(p).marca;
    if (!m) return;
    try {
      await this.asis.aprobar(m.id);
      this.avisos.ok('Marca aprobada', p.nombre);
    } catch (e) {
      this.avisos.error('No se pudo aprobar', e);
    }
  }

  /** Registro del mes en Excel (CSV). */
  protected exportar() {
    const cab = [
      'Trabajador',
      'Cargo',
      ...this.dias().map((d) => this.numero(d).toString()),
      'Asistencias',
      'Tardanzas',
      'Min. tarde',
      'Faltas',
      'Justificados',
      'Horas',
    ];
    const corto: Record<EstadoDia, string> = {
      puntual: 'A',
      tarde: 'T',
      pendiente: 'P',
      justificado: 'J',
      falta: 'F',
      por_llegar: '',
      descanso: 'D',
      futuro: '',
    };
    const filas = this.personas().map((p) => {
      const t = this.totalesMes(p);
      return [
        p.nombre,
        p.cargo,
        ...this.dias().map((d) => corto[this.dia(p, d).estado]),
        String(t.asistencias),
        String(t.tardanzas),
        String(t.minutosTarde),
        String(t.faltas),
        String(t.justificados),
        aHoras(t.minutosTrabajados),
      ];
    });
    const csv =
      '﻿' +
      [
        cab,
        ...filas,
        [],
        [
          'A = a tiempo · T = tardanza · P = por aprobar · J = justificado · F = falta · D = descanso',
        ],
      ]
        .map((f) => f.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(';'))
        .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    Object.assign(document.createElement('a'), {
      href: url,
      download: `asistencia-almacen-${this.hoy().slice(0, 7)}.csv`,
    }).click();
    URL.revokeObjectURL(url);
  }
}

function minutosAhora() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

/** 25 → "25 min" · 85 → "1 h 25 min". */
function duracion(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
}
