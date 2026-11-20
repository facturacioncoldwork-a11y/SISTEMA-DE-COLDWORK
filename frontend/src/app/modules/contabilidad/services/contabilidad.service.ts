import { computed, Injectable, signal } from '@angular/core';
import { ASIENTOS_EJEMPLO } from '../data/ejemplo';
import { ACTIVIDAD_EJEMPLO, CONTADORA, DUENO, PERSONAS } from '../data/equipo-ejemplo';
import { PCGE } from '../data/pcge';
import type {
  AccionActividad,
  Actividad,
  Asiento,
  ConfigAprobacion,
  Cuenta,
  NuevoAsiento,
  Persona,
  Regimen,
  RolContable,
  TramoIngresos,
} from '../models/contabilidad.model';
import { validarAsiento } from '../utils/partida-doble';
import { permisosDe, puedeEditar } from '../utils/permisos';

/**
 * Estado del módulo Contabilidad: UNA sola fuente de datos que ven el dueño y el contador.
 *
 * PROTOTIPO: todo vive en memoria (se pierde al recargar). Al conectarlo:
 *  - los métodos llamarán al backend (/api/v1/contabilidad) con la misma forma;
 *  - la persona actual saldrá de la sesión (EmpresaActualService) en vez del selector "Ver como";
 *  - los cambios de otros llegarán en vivo con Supabase Realtime.
 */
@Injectable({ providedIn: 'root' })
export class ContabilidadService {
  // ─── Plan de cuentas ──────────────────────────────────────────
  readonly cuentas: Cuenta[] = PCGE;
  readonly porCodigo: ReadonlyMap<string, Cuenta> = new Map(PCGE.map((c) => [c.codigo, c]));
  readonly cuentasMovimiento = PCGE.filter((c) => c.movimiento);

  // ─── Configuración tributaria (luego vendrá de la empresa) ───────
  readonly regimen = signal<Regimen>('rmt');
  readonly tramo = signal<TramoIngresos>('hasta300');

  // ─── Quién está usando el módulo (simulación) ─────────────────
  readonly personas = PERSONAS;
  readonly vista = signal<RolContable>('dueno');
  readonly persona = computed<Persona>(() => (this.vista() === 'dueno' ? DUENO : CONTADORA));
  readonly config = signal<ConfigAprobacion>({ contadorRegistraDirecto: false });
  readonly permisos = computed(() => permisosDe(this.persona(), this.config()));

  // ─── Periodo, asientos y actividad ────────────────────────────
  readonly periodo = signal('2026-11');
  private readonly todos = signal<Asiento[]>(structuredClone(ASIENTOS_EJEMPLO));
  readonly actividad = signal<Actividad[]>(structuredClone(ACTIVIDAD_EJEMPLO));

  /** Asientos del periodo elegido, del más reciente al más antiguo. */
  readonly asientos = computed(() =>
    this.todos()
      .filter((a) => a.periodo === this.periodo())
      .sort((a, b) => b.numero - a.numero),
  );

  readonly porAprobar = computed(() => this.todos().filter((a) => a.estado === 'por_aprobar'));

  readonly periodos = computed(() => {
    const lista = new Set(this.todos().map((a) => a.periodo));
    lista.add(this.periodo());
    return [...lista].sort().reverse();
  });

  nombreCuenta(codigo: string): string {
    return this.porCodigo.get(codigo)?.nombre ?? '';
  }

  buscar(id: string): Asiento {
    const asiento = this.todos().find((a) => a.id === id);
    if (!asiento) throw new Error('El asiento no existe.');
    return asiento;
  }

  // ─── Crear y corregir ─────────────────────────────────────────

  /**
   * Crea el asiento. `confirmar` = el botón principal: registra si la persona puede,
   * o lo envía a aprobación del dueño. Sin confirmar queda como borrador.
   */
  crear(datos: NuevoAsiento, confirmar: boolean, autor: Persona = this.persona()): Asiento {
    if (confirmar) this.exigirValido(datos);

    const periodo = datos.fecha.slice(0, 7);
    const estado = !confirmar ? 'borrador' : permisosDe(autor, this.config()).registrar ? 'registrado' : 'por_aprobar';
    const asiento: Asiento = {
      ...datos,
      lineas: datos.lineas.filter((l) => l.cuenta),
      id: crypto.randomUUID(),
      numero: this.siguienteNumero(periodo),
      periodo,
      estado,
      creadoEn: new Date().toISOString(),
      creadoPor: autor.id,
      registradoPor: estado === 'registrado' ? autor.id : undefined,
    };

    this.todos.update((lista) => [...lista, asiento]);
    this.anotar(asiento, estado === 'registrado' ? 'registro' : estado === 'por_aprobar' ? 'envio' : 'creo', autor);
    return asiento;
  }

  /** Corrige un borrador u observado; con `confirmar` lo vuelve a enviar o lo registra. */
  actualizar(id: string, datos: NuevoAsiento, confirmar: boolean): Asiento {
    const actual = this.buscar(id);
    if (!puedeEditar(actual, this.persona())) throw new Error('Este asiento ya no se puede editar.');
    if (confirmar) this.exigirValido(datos);

    const estado = !confirmar ? actual.estado : this.permisos().registrar ? 'registrado' : 'por_aprobar';
    const corregido: Asiento = {
      ...actual,
      ...datos,
      lineas: datos.lineas.filter((l) => l.cuenta),
      estado,
      observacion: confirmar ? undefined : actual.observacion,
      registradoPor: estado === 'registrado' ? this.persona().id : undefined,
    };

    this.reemplazar(corregido);
    this.anotar(corregido, estado === 'registrado' ? 'registro' : estado === 'por_aprobar' ? 'envio' : 'edito');
    return corregido;
  }

  // ─── Flujo de aprobación ──────────────────────────────────────

  /** El contador manda su borrador al dueño. */
  enviar(id: string): void {
    const asiento = this.buscar(id);
    this.exigirValido(asiento);
    this.reemplazar({ ...asiento, estado: 'por_aprobar', observacion: undefined });
    this.anotar(asiento, 'envio');
  }

  /** Registra un borrador propio (si tiene permiso) o aprueba uno pendiente (dueño). */
  registrar(id: string): void {
    const asiento = this.buscar(id);
    const esAprobacion = asiento.estado === 'por_aprobar';
    if (esAprobacion ? !this.permisos().aprobar : !this.permisos().registrar) {
      throw new Error('No tienes permiso para registrar este asiento.');
    }
    this.exigirValido(asiento);
    this.reemplazar({ ...asiento, estado: 'registrado', registradoPor: this.persona().id });
    this.anotar(asiento, esAprobacion ? 'aprobo' : 'registro');
  }

  /** El dueño devuelve el asiento al contador con un comentario. */
  observar(id: string, comentario: string): void {
    if (!this.permisos().aprobar) throw new Error('Solo el dueño puede observar asientos.');
    const asiento = this.buscar(id);
    this.reemplazar({ ...asiento, estado: 'observado', observacion: comentario.trim() });
    this.anotar(asiento, 'observo', this.persona(), comentario.trim());
  }

  /** Anula sin borrar: el número queda en el libro para no romper el correlativo. */
  anular(id: string): void {
    if (!this.permisos().anular) throw new Error('Solo el dueño puede anular asientos.');
    const asiento = this.buscar(id);
    this.reemplazar({ ...asiento, estado: 'anulado' });
    this.anotar(asiento, 'anulo');
  }

  eliminarBorrador(id: string): void {
    const asiento = this.buscar(id);
    if (!puedeEditar(asiento, this.persona())) throw new Error('Solo se eliminan borradores propios.');
    this.todos.update((lista) => lista.filter((a) => a.id !== id));
    this.anotar(asiento, 'elimino');
  }

  // ─── Simulación de trabajo en vivo ────────────────────────────

  /**
   * Simula que la contadora, desde otra computadora, registra una venta.
   * Al conectar Supabase Realtime esto llegará solo, sin este método.
   */
  simularContadora(): Asiento {
    const base = 800 + Math.round(Math.random() * 40) * 50;
    const igv = Math.round(base * 18) / 100;
    return this.crear(
      {
        fecha: this.periodo() + '-20',
        origen: 'ventas',
        glosa: 'Recarga de gas refrigerante R-404A',
        moneda: 'PEN',
        documento: {
          tipo: '01',
          serie: 'F001',
          numero: String(127 + this.todos().length),
          documentoTercero: '20000000004',
          nombreTercero: 'Minimarket de Ejemplo S.A.C.',
        },
        lineas: [
          { cuenta: '1212', debe: base + igv, haber: 0 },
          { cuenta: '40111', debe: 0, haber: igv },
          { cuenta: '7041', debe: 0, haber: base },
        ],
      },
      true,
      CONTADORA,
    );
  }

  // ─── Internos ────────────────────────────────────────────────

  private exigirValido(datos: NuevoAsiento): void {
    const errores = validarAsiento(datos, this.porCodigo);
    if (errores.length) throw new Error(errores[0]);
  }

  private reemplazar(asiento: Asiento): void {
    this.todos.update((lista) => lista.map((a) => (a.id === asiento.id ? asiento : a)));
  }

  private anotar(asiento: Asiento, accion: AccionActividad, persona = this.persona(), detalle?: string): void {
    const entrada: Actividad = {
      id: crypto.randomUUID(),
      fecha: new Date().toISOString(),
      personaId: persona.id,
      accion,
      asientoId: asiento.id,
      numero: asiento.numero,
      glosa: asiento.glosa,
      detalle,
    };
    this.actividad.update((lista) => [entrada, ...lista]);
  }

  private siguienteNumero(periodo: string): number {
    const numeros = this.todos()
      .filter((a) => a.periodo === periodo)
      .map((a) => a.numero);
    return Math.max(0, ...numeros) + 1;
  }
}
