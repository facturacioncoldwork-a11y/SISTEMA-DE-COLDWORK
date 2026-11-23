import { computed, DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { ApiService } from '../../../core/api/services/api.service';
import { AuthService } from '../../../core/auth/services/auth.service';
import { EmpresaActualService } from '../../../core/empresa/services/empresa-actual.service';
import { veTodo } from '../../../core/permisos/areas';
import { SupabaseService } from '../../../core/supabase/services/supabase.service';
import { PCGE } from '../data/pcge';
import { ACCIONES } from '../data/textos';
import type {
  AccionActividad,
  Actividad,
  Adjunto,
  Asiento,
  ConfigAprobacion,
  Cuenta,
  NuevoAsiento,
  Persona,
} from '../models/contabilidad.model';
import { validarAsiento } from '../utils/partida-doble';
import { permisosDe } from '../utils/permisos';

type AccionEstado = 'enviar' | 'registrar' | 'observar' | 'anular' | 'eliminar';

const CONFIG_INICIAL: ConfigAprobacion = {
  regimen: 'rmt',
  tramo: 'hasta300',
  contadorRegistraDirecto: false,
  contadorVeLibros: true,
};

/**
 * Estado del módulo Contabilidad: UNA sola fuente de datos (Supabase) que ven el dueño y el contador.
 *
 *  - Lee y escribe por la API (/api/v1/contabilidad). Las reglas contables las aplica la base de datos.
 *  - Escucha cambios en vivo (Supabase Realtime): si el contador registra algo, el dueño lo ve al instante.
 *  - Solo trae el periodo que se está viendo, para que funcione igual de rápido con miles de asientos.
 */
@Injectable({ providedIn: 'root' })
export class ContabilidadService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly empresa = inject(EmpresaActualService);
  private readonly supabase = inject(SupabaseService).client;

  // ─── Plan de cuentas (PCGE 2019, fijo) ──────────────────────────
  readonly cuentas: Cuenta[] = PCGE;
  readonly porCodigo: ReadonlyMap<string, Cuenta> = new Map(PCGE.map((c) => [c.codigo, c]));
  readonly cuentasMovimiento = PCGE.filter((c) => c.movimiento);

  // ─── Quién está usando el módulo (sesión real) ─────────────────

  /** Dueño y admin aprueban; el resto trabaja como contador (envía a aprobación). */
  readonly persona = computed<Persona>(() => {
    const usuario = this.auth.usuario();
    const nombre = (usuario?.user_metadata?.['nombre'] as string | undefined) || usuario?.email || 'Usuario';
    return { id: usuario?.id ?? 'sin-sesion', nombre, rol: veTodo(this.empresa.rol()) ? 'dueno' : 'contador' };
  });

  readonly config = signal<ConfigAprobacion>(CONFIG_INICIAL);
  readonly regimen = computed(() => this.config().regimen);
  readonly tramo = computed(() => this.config().tramo);
  readonly permisos = computed(() => permisosDe(this.persona(), this.config()));

  // ─── Datos del servidor ───────────────────────────────────────
  readonly periodo = signal(periodoActual());
  readonly asientos = signal<Asiento[]>([]);
  readonly porAprobar = signal<Asiento[]>([]);
  readonly actividad = signal<Actividad[]>([]);
  private readonly periodosServidor = signal<string[]>([]);

  readonly cargando = signal(false);
  /** Ya llegó la primera carga de la empresa actual. */
  readonly cargado = signal(false);
  readonly error = signal<string | null>(null);

  readonly periodos = computed(() =>
    [...new Set([periodoActual(), this.periodo(), ...this.periodosServidor()])].sort().reverse(),
  );

  /** Nombres conocidos de quienes registraron o hicieron algo. */
  private readonly nombres = computed(() => {
    const mapa = new Map<string, string>();
    for (const a of [...this.asientos(), ...this.porAprobar()]) {
      if (a.creadoPor && a.creadoPorNombre) mapa.set(a.creadoPor, a.creadoPorNombre);
    }
    for (const a of this.actividad()) {
      if (a.personaId && a.personaNombre) mapa.set(a.personaId, a.personaNombre);
    }
    return mapa;
  });

  private canal: RealtimeChannel | null = null;
  private pendiente: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Recarga al cambiar de empresa o de periodo
    effect(() => {
      const empresaId = this.empresa.id();
      this.periodo();
      if (!empresaId) return;
      untracked(() => this.cargado.set(false));
      untracked(() => void this.recargar());
    });

    // Cambios en vivo de la empresa actual
    effect(() => {
      const empresaId = this.empresa.id();
      untracked(() => this.escuchar(empresaId));
    });

    inject(DestroyRef).onDestroy(() => this.dejarDeEscuchar());
  }

  // ─── Textos ──────────────────────────────────────────────────

  nombreCuenta(codigo: string): string {
    return this.porCodigo.get(codigo)?.nombre ?? '';
  }

  /** "Tú" si es quien mira la pantalla; si no, el nombre de la persona. */
  nombrePersona(id: string | undefined): string {
    if (id && id === this.persona().id) return 'Tú';
    return (id && this.nombres().get(id)) || 'Otro usuario';
  }

  /** Frase de una actividad desde el punto de vista de quien mira: "Tú aprobaste" / "Ana aprobó". */
  describir(personaId: string, accion: AccionActividad): string {
    const yo = personaId === this.persona().id;
    return `${this.nombrePersona(personaId)} ${yo ? ACCIONES[accion].textoYo : ACCIONES[accion].texto}`;
  }

  buscar(id: string): Asiento {
    const asiento = [...this.asientos(), ...this.porAprobar()].find((a) => a.id === id);
    if (!asiento) throw new Error('El asiento no existe.');
    return asiento;
  }

  // ─── Carga ───────────────────────────────────────────────────

  /** Trae del servidor todo lo que se muestra (en paralelo). */
  async recargar(): Promise<void> {
    if (!this.empresa.id()) return;
    this.cargando.set(true);
    try {
      const [asientos, porAprobar, actividad, periodos, config] = await Promise.all([
        this.api.get<Asiento[]>(`/contabilidad/asientos?periodo=${this.periodo()}`),
        this.api.get<Asiento[]>('/contabilidad/por-aprobar'),
        this.api.get<Actividad[]>('/contabilidad/actividad'),
        this.api.get<string[]>('/contabilidad/periodos'),
        this.api.get<ConfigAprobacion>('/contabilidad/config'),
      ]);
      this.asientos.set(asientos);
      this.porAprobar.set(porAprobar);
      this.actividad.set(actividad);
      this.periodosServidor.set(periodos);
      this.config.set({ ...CONFIG_INICIAL, ...config });
      this.error.set(null);
      this.cargado.set(true);
    } catch (e) {
      this.error.set(mensaje(e, 'No se pudo cargar la contabilidad.'));
    } finally {
      this.cargando.set(false);
    }
  }

  // ─── Crear y corregir ─────────────────────────────────────────

  /**
   * Crea el asiento. `confirmar` = botón principal: registra si la persona puede,
   * o lo envía a aprobación del dueño. Sin confirmar queda como borrador.
   */
  async crear(datos: NuevoAsiento, confirmar: boolean): Promise<Asiento> {
    if (confirmar) this.exigirValido(datos);
    const asiento = await this.ejecutar(() =>
      this.api.post<Asiento>('/contabilidad/asientos', { datos: paraEnviar(datos), confirmar }),
    );
    return asiento;
  }

  /** Corrige un borrador u observado; con `confirmar` lo vuelve a enviar o lo registra. */
  async actualizar(id: string, datos: NuevoAsiento, confirmar: boolean): Promise<Asiento> {
    if (confirmar) this.exigirValido(datos);
    return this.ejecutar(() =>
      this.api.patch<Asiento>(`/contabilidad/asientos/${id}`, { datos: paraEnviar(datos), confirmar }),
    );
  }

  // ─── Flujo de aprobación ──────────────────────────────────────

  enviar(id: string) {
    return this.cambiarEstado(id, 'enviar');
  }

  /** Registra un borrador propio (si tiene permiso) o aprueba uno pendiente (dueño). */
  registrar(id: string) {
    return this.cambiarEstado(id, 'registrar');
  }

  observar(id: string, comentario: string) {
    return this.cambiarEstado(id, 'observar', comentario);
  }

  /** Anula sin borrar: el número queda en el libro para no romper el correlativo. */
  anular(id: string) {
    return this.cambiarEstado(id, 'anular');
  }

  eliminarBorrador(id: string) {
    return this.cambiarEstado(id, 'eliminar');
  }

  /** Guarda régimen o permisos del contador (solo dueño o admin). */
  async guardarConfig(cambios: Partial<ConfigAprobacion>): Promise<void> {
    const nueva = { ...this.config(), ...cambios };
    const guardada = await this.ejecutar(() => this.api.put<ConfigAprobacion>('/contabilidad/config', nueva));
    this.config.set({ ...CONFIG_INICIAL, ...guardada });
  }

  // ─── Comprobantes (almacenamiento privado) ────────────────────

  /** Sube la foto o PDF a la carpeta privada de la empresa y devuelve su referencia. */
  async subirAdjunto(archivo: File): Promise<Adjunto> {
    const empresaId = this.empresa.id();
    if (!empresaId) throw new Error('Elige una empresa primero.');
    const limpio = archivo.name.replace(/[^\w.-]+/g, '_').slice(-80);
    const ruta = `${empresaId}/${crypto.randomUUID()}/${limpio}`;
    const { error } = await this.supabase.storage
      .from('comprobantes')
      .upload(ruta, archivo, { contentType: archivo.type, upsert: false });
    if (error) throw new Error('No se pudo subir el archivo. Intenta de nuevo.');
    return { nombre: archivo.name, tipo: archivo.type, tamano: archivo.size, ruta };
  }

  /** Abre el comprobante con un enlace temporal (5 minutos). */
  async verAdjunto(ruta: string): Promise<void> {
    const { data, error } = await this.supabase.storage.from('comprobantes').createSignedUrl(ruta, 300);
    if (error || !data) throw new Error('No se pudo abrir el archivo.');
    window.open(data.signedUrl, '_blank', 'noopener');
  }

  // ─── Internos ────────────────────────────────────────────────

  private async cambiarEstado(id: string, accion: AccionEstado, comentario?: string): Promise<void> {
    await this.ejecutar(() => this.api.post<void>(`/contabilidad/asientos/${id}/estado`, { accion, comentario }));
  }

  /** Ejecuta en el servidor, recarga y traduce el error a un mensaje claro. */
  private async ejecutar<T>(accion: () => Promise<T>): Promise<T> {
    try {
      const resultado = await accion();
      await this.recargar();
      return resultado;
    } catch (e) {
      throw new Error(mensaje(e, 'No se pudo completar.'), { cause: e });
    }
  }

  private exigirValido(datos: NuevoAsiento): void {
    const errores = validarAsiento(datos, this.porCodigo);
    if (errores.length) throw new Error(errores[0]);
  }

  /** Escucha cambios de asientos y actividad de la empresa (filtrado por RLS en el servidor). */
  private escuchar(empresaId: string | null): void {
    this.dejarDeEscuchar();
    if (!empresaId) return;
    const filtro = `empresa_id=eq.${empresaId}`;
    this.canal = this.supabase
      .channel(`contabilidad-${empresaId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conta_asientos', filter: filtro }, () =>
        this.recargarPronto(),
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conta_actividad', filter: filtro }, () =>
        this.recargarPronto(),
      )
      .subscribe();
  }

  /** Agrupa varios cambios seguidos en una sola recarga. */
  private recargarPronto(): void {
    if (this.pendiente) clearTimeout(this.pendiente);
    this.pendiente = setTimeout(() => void this.recargar(), 400);
  }

  private dejarDeEscuchar(): void {
    if (this.canal) void this.supabase.removeChannel(this.canal);
    this.canal = null;
  }
}

/** Mes actual en hora local: "AAAA-MM". */
function periodoActual(): string {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
}

/** Quita campos vacíos antes de enviar (la API rechaza campos extra o mal formados). */
function paraEnviar(datos: NuevoAsiento) {
  const documento = datos.documento
    ? {
        tipo: datos.documento.tipo,
        serie: datos.documento.serie.trim(),
        numero: datos.documento.numero.trim(),
        ...(datos.documento.documentoTercero?.trim() ? { documentoTercero: datos.documento.documentoTercero.trim() } : {}),
        ...(datos.documento.nombreTercero?.trim() ? { nombreTercero: datos.documento.nombreTercero.trim() } : {}),
      }
    : undefined;
  return {
    fecha: datos.fecha,
    origen: datos.origen,
    glosa: datos.glosa.trim(),
    moneda: datos.moneda,
    ...(datos.moneda === 'USD' && datos.tipoCambio ? { tipoCambio: datos.tipoCambio } : {}),
    ...(documento ? { documento } : {}),
    adjuntos: datos.adjuntos ?? [],
    lineas: datos.lineas
      .filter((l) => l.cuenta)
      .map((l) => ({
        cuenta: l.cuenta,
        debe: Number(l.debe) || 0,
        haber: Number(l.haber) || 0,
        ...(l.glosa?.trim() ? { glosa: l.glosa.trim() } : {}),
      })),
  };
}

function mensaje(e: unknown, porDefecto: string): string {
  const msg = (e as { error?: { message?: string | string[] } })?.error?.message;
  if (Array.isArray(msg)) return msg.join(' · ');
  if (msg) return msg;
  return e instanceof Error && e.message ? e.message : porDefecto;
}
