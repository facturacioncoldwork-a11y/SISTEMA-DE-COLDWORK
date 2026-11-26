import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { SelectModule } from 'primeng/select';
import { mensajeError } from '../../../../core/api/errores';
import type { ResultadoMarca } from '../../models/personal.model';
import { AsistenciaStore, LUGAR_OFICINA } from '../../services/asistencia-store.service';
import { distanciaMetros } from '../../utils/horas';

type Forma = 'gps' | 'codigo' | 'manual';

/**
 * Cómo marca un trabajador (la empresa elige qué formas activar):
 *  1. Celular + GPS: el servidor valida la distancia a la oficina (técnicos pueden marcar en campo).
 *  2. Código de la oficina: la tablet muestra un número que cambia cada 30 s (lo genera el servidor).
 *  3. Manual: solo el supervisor, con motivo (queda en el historial).
 * La hora siempre la pone el servidor; nadie puede elegirla salvo la marca "sin GPS", que queda por aprobar.
 */
@Component({
  selector: 'app-marcar',
  imports: [FormsModule, SelectModule],
  templateUrl: './marcar.html',
  styleUrl: './marcar.scss',
})
export class Marcar {
  protected readonly sim = inject(AsistenciaStore);
  private readonly avisos = inject(MessageService);

  protected readonly metodo = signal<Forma>('gps');
  protected readonly enviando = signal(false);

  /** Cada uno marca lo suyo; solo en "Manual" el supervisor elige a otro trabajador. */
  private readonly elegido = signal<string | null>(null);
  protected readonly trabajadorId = computed(() => (this.metodo() === 'manual' ? (this.elegido() ?? this.sim.yoId()) : this.sim.yoId()));
  protected readonly trabajador = computed(() => this.sim.trabajador(this.trabajadorId()));
  protected readonly marcaHoy = computed(() => this.sim.marcaDe(this.trabajadorId()));
  protected readonly accion = computed(() => (this.marcaHoy()?.salida ? 'ya' : this.marcaHoy() ? 'salida' : 'entrada'));
  protected readonly opciones = computed(() => this.sim.trabajadores().map((t) => ({ id: t.id, etiqueta: `${t.nombre}${t.cargo ? ' · ' + t.cargo : ''}` })));

  // ── GPS ───────────────────────────────────────────────────────
  protected readonly ubicacion = signal<{ lat: number; lng: number; precision: number } | null>(null);
  protected readonly buscando = signal(false);
  protected readonly distancia = computed(() => {
    const u = this.ubicacion();
    const o = this.sim.horario().oficina;
    return u && o ? Math.round(distanciaMetros(u, o)) : null;
  });
  /** Solo orientativo: la validación real la hace el servidor con las mismas reglas. */
  protected readonly zona = computed(() => {
    if (this.ubicacion() && !this.sim.horario().oficina) {
      return { ok: false, texto: 'La empresa aún no fijó la ubicación de la oficina.' };
    }
    const d = this.distancia();
    if (d === null) return null;
    if (d <= this.sim.horario().radioOficina) return { ok: true, texto: `En la oficina (a ${d} m)` };
    if (this.trabajador()?.campo) return { ok: true, texto: `En campo, a ${(d / 1000).toFixed(1)} km de la oficina` };
    return { ok: false, texto: `Fuera de la oficina (a ${(d / 1000).toFixed(1)} km). El personal de oficina solo marca dentro.` };
  });

  // ── Código de oficina (la tablet la ve solo quien gestiona asistencia) ──
  protected readonly codigo = signal<string | null>(null);
  protected readonly segundos = signal(0);
  protected codigoEscrito = '';

  // ── Manual / sin GPS ──────────────────────────────────────────
  protected motivoManual = '';
  protected readonly sinGps = signal(false);
  protected horaDeclarada = '';
  protected motivoDeclarado = '';

  constructor() {
    const id = setInterval(() => this.tic(), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }

  /** Cuenta regresiva del código; al vencer pide el siguiente al servidor (una llamada cada 30 s). */
  private tic() {
    if (this.metodo() !== 'codigo' || !this.sim.esGestor()) return;
    const s = this.segundos() - 1;
    if (s > 0) this.segundos.set(s);
    else void this.pedirCodigo();
  }

  private async pedirCodigo() {
    this.segundos.set(30);
    try {
      const r = await this.sim.codigoOficina();
      this.codigo.set(r.codigo);
      this.segundos.set(r.segundos);
    } catch {
      this.codigo.set(null);
    }
  }

  protected elegirForma(f: Forma) {
    this.metodo.set(f);
    if (f === 'codigo' && this.sim.esGestor()) void this.pedirCodigo();
  }

  protected iniciales() {
    return (this.trabajador()?.nombre ?? '').split(' ').map((p) => p[0]).slice(0, 2).join('');
  }

  protected elegirTrabajador(id: string) {
    this.elegido.set(id);
  }

  /** Pide la ubicación del navegador (con permiso), solo en el momento de marcar: no se rastrea a nadie. */
  protected obtenerUbicacion() {
    if (!('geolocation' in navigator)) return this.error('Este equipo no tiene GPS: usa el código de oficina o "¿Tu celular falla?".');
    this.buscando.set(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        this.buscando.set(false);
        this.ubicacion.set({ lat: p.coords.latitude, lng: p.coords.longitude, precision: Math.round(p.coords.accuracy) });
      },
      () => {
        this.buscando.set(false);
        this.avisos.add({ severity: 'info', summary: 'Ubicación no disponible', detail: 'Activa el GPS o usa "¿Tu celular falla?".', life: 4000 });
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  protected marcarGps() {
    const u = this.ubicacion();
    if (!u) return this.error('Primero obtén tu ubicación.');
    const z = this.zona();
    if (z && !z.ok) return this.error(z.texto);
    void this.enviar(() => this.sim.marcar({ metodo: 'gps', lat: u.lat, lng: u.lng }), () => this.ubicacion.set(null));
  }

  protected marcarCodigo() {
    const c = this.codigoEscrito.replace(/\s/g, '');
    if (!/^\d{6}$/.test(c)) return this.error('Escribe los 6 números que ves en la tablet.');
    void this.enviar(() => this.sim.marcar({ metodo: 'codigo', codigo: c }), () => (this.codigoEscrito = ''));
  }

  protected marcarManual() {
    const motivo = this.motivoManual.trim();
    if (motivo.length < 5) return this.error('Escribe el motivo (queda registrado con tu nombre).');
    void this.enviar(() => this.sim.marcarManual(this.trabajadorId(), motivo), () => (this.motivoManual = ''));
  }

  protected abrirSinGps() {
    const a = new Date();
    this.horaDeclarada = `${String(a.getHours()).padStart(2, '0')}:${String(a.getMinutes()).padStart(2, '0')}`;
    this.motivoDeclarado = '';
    this.sinGps.set(true);
  }

  /** Para quien no pudo marcar con GPS: indica la hora y el motivo; queda "por aprobar". */
  protected marcarSinGps() {
    if (!/^\d{2}:\d{2}$/.test(this.horaDeclarada)) return this.error('Indica la hora.');
    const motivo = this.motivoDeclarado.trim();
    if (motivo.length < 5) return this.error('Cuenta brevemente qué pasó (ej. celular sin señal en la planta).');
    void this.enviar(() => this.sim.marcar({ metodo: 'declarada', hora: this.horaDeclarada, motivo }), () => this.sinGps.set(false));
  }

  private async enviar(llamada: () => Promise<ResultadoMarca>, alTerminar: () => void) {
    if (this.enviando()) return;
    this.enviando.set(true);
    try {
      const r = await llamada();
      alTerminar();
      this.avisos.add({
        severity: 'success',
        summary: `${r.accion === 'entrada' ? 'Entrada' : 'Salida'} registrada · ${r.hora}`,
        detail: r.pendiente ? 'Queda por aprobar: tu supervisor lo revisa en "Hoy".' : `${this.trabajador()?.nombre ?? ''} · ${r.lugar ?? LUGAR_OFICINA}`,
        life: 4500,
      });
    } catch (e) {
      this.error(mensajeError(e) ?? 'Inténtalo de nuevo en un momento.');
    } finally {
      this.enviando.set(false);
    }
  }

  private error(texto: string) {
    this.avisos.add({ severity: 'warn', summary: 'No se pudo marcar', detail: texto, life: 5000 });
  }
}
