import { computed, inject, Injectable, signal } from '@angular/core';
import { AuthService } from '../../../core/auth/services/auth.service';
import { EmpresaActualService } from '../../../core/empresa/services/empresa-actual.service';
import { veTodo } from '../../../core/permisos/areas';
import { PCGE } from '../data/pcge';
import { ACCIONES } from '../data/textos';
import type {
  AccionActividad,
  Actividad,
  Asiento,
  ConfigAprobacion,
  Cuenta,
  NuevoAsiento,
  Persona,
  Regimen,
  TramoIngresos,
} from '../models/contabilidad.model';
import { validarAsiento } from '../utils/partida-doble';
import { permisosDe, puedeEditar } from '../utils/permisos';

/**
 * Estado del módulo Contabilidad: UNA sola fuente de datos que ven el dueño y el contador.
 *
 * La persona y su rol salen de la sesión real (cuenta + empresa elegida).
 * Pendiente: guardar los asientos en la base de datos (hoy viven en memoria y se pierden al recargar);
 * los métodos llamarán al backend (/api/v1/contabilidad) con la misma forma y los cambios de otros
 * llegarán en vivo con Supabase Realtime.
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

  // ─── Quién está usando el módulo (sesión real) ─────────────────
  private readonly auth = inject(AuthService);
  private readonly empresa = inject(EmpresaActualService);

  /** Dueño y admin aprueban; el resto trabaja como contador (envía a aprobación). */
  readonly persona = computed<Persona>(() => {
    const usuario = this.auth.usuario();
    const nombre = (usuario?.user_metadata?.['nombre'] as string | undefined) || usuario?.email || 'Usuario';
    return { id: usuario?.id ?? 'sin-sesion', nombre, rol: veTodo(this.empresa.rol()) ? 'dueno' : 'contador' };
  });

  /** Nombres de quienes hicieron algo (para la actividad). */
  private readonly nombres = new Map<string, string>();
  readonly config = signal<ConfigAprobacion>({ contadorRegistraDirecto: false, contadorVeLibros: true });
  readonly permisos = computed(() => permisosDe(this.persona(), this.config()));

  // ─── Periodo, asientos y actividad ────────────────────────────
  readonly periodo = signal(periodoActual());
  private readonly todos = signal<Asiento[]>([]);
  readonly actividad = signal<Actividad[]>([]);

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

  /** "Tú" si es quien mira la pantalla; si no, el nombre de la persona. */
  nombrePersona(id: string | undefined): string {
    if (id === this.persona().id) return 'Tú';
    return (id && this.nombres.get(id)) || 'Otro usuario';
  }

  /** Frase de una actividad desde el punto de vista de quien mira: "Tú aprobaste" / "Ana aprobó". */
  describir(personaId: string, accion: AccionActividad): string {
    const yo = personaId === this.persona().id;
    return `${this.nombrePersona(personaId)} ${yo ? ACCIONES[accion].textoYo : ACCIONES[accion].texto}`;
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

  // ─── Internos ────────────────────────────────────────────────

  private exigirValido(datos: NuevoAsiento): void {
    const errores = validarAsiento(datos, this.porCodigo);
    if (errores.length) throw new Error(errores[0]);
  }

  private reemplazar(asiento: Asiento): void {
    this.todos.update((lista) => lista.map((a) => (a.id === asiento.id ? asiento : a)));
  }

  private anotar(asiento: Asiento, accion: AccionActividad, persona = this.persona(), detalle?: string): void {
    this.nombres.set(persona.id, persona.nombre);
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

/** Mes actual en hora local: "AAAA-MM". */
function periodoActual(): string {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
}
