import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { SelectModule } from 'primeng/select';
import type { MetodoMarca } from '../../models/personal.model';
import { AsistenciaSim, OFICINA } from '../../services/asistencia-sim.service';
import { codigoDelMomento, distanciaMetros } from '../../utils/horas';

/**
 * Cómo marca un trabajador. Tres formas (la empresa elige cuáles activar):
 *  1. Celular + GPS + selfie: para técnicos en campo y personal de oficina.
 *  2. Código de la oficina: una tablet muestra un número que cambia cada 30 s.
 *  3. Manual: el supervisor registra con motivo (queda en el historial).
 */
@Component({
  selector: 'app-marcar',
  imports: [FormsModule, SelectModule],
  templateUrl: './marcar.html',
  styleUrl: './marcar.scss',
})
export class Marcar {
  protected readonly sim = inject(AsistenciaSim);
  private readonly avisos = inject(MessageService);

  protected readonly metodo = signal<MetodoMarca>('gps');
  protected readonly trabajadorId = signal('t1');
  protected readonly trabajador = computed(() => this.sim.trabajador(this.trabajadorId()));
  protected readonly marcaHoy = computed(() => this.sim.marcaDe(this.trabajadorId()));
  protected readonly accion = computed(() => (this.marcaHoy()?.salida ? 'ya' : this.marcaHoy() ? 'salida' : 'entrada'));

  // ── GPS + selfie ───────────────────────────────────────────────
  protected readonly ubicacion = signal<{ lat: number; lng: number; precision: number; simulada: boolean } | null>(null);
  protected readonly buscando = signal(false);
  protected readonly selfie = signal<string | null>(null);
  protected readonly distancia = computed(() => {
    const u = this.ubicacion();
    return u ? Math.round(distanciaMetros(u, OFICINA)) : null;
  });
  /** Dentro de la oficina, o técnico de campo (en la versión real: cerca de la obra de su orden de trabajo). */
  protected readonly zona = computed(() => {
    const d = this.distancia();
    if (d === null) return null;
    if (d <= this.sim.horario().radioOficina) return { ok: true, lugar: OFICINA.nombre, texto: `En la oficina (a ${d} m)` };
    if (this.trabajador()?.campo) return { ok: true, lugar: 'Obra del cliente (OT del día)', texto: `En campo, a ${(d / 1000).toFixed(1)} km de la oficina` };
    return { ok: false, lugar: '', texto: `Fuera de la oficina (a ${(d / 1000).toFixed(1)} km). Personal de oficina solo marca dentro.` };
  });

  // ── Código de oficina ─────────────────────────────────────────
  private readonly reloj = signal(Date.now());
  protected readonly codigo = computed(() => codigoDelMomento('coldwork-oficina', this.reloj()));
  protected readonly segundos = computed(() => 30 - (Math.floor(this.reloj() / 1000) % 30));
  protected codigoEscrito = '';

  // ── Manual ────────────────────────────────────────────────────
  protected motivoManual = '';

  protected readonly opciones = computed(() => this.sim.trabajadores().map((t) => ({ id: t.id, etiqueta: `${t.nombre} · ${t.cargo}` })));
  protected readonly oficina = OFICINA;

  constructor() {
    const id = setInterval(() => this.reloj.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }

  protected iniciales() {
    return (this.trabajador()?.nombre ?? '').split(' ').map((p) => p[0]).slice(0, 2).join('');
  }

  protected elegirTrabajador(id: string) {
    this.trabajadorId.set(id);
    this.ubicacion.set(null);
    this.selfie.set(null);
  }

  /** Pide la ubicación real del navegador (con permiso). Solo en el momento de marcar: no se rastrea a nadie. */
  protected obtenerUbicacion() {
    if (!('geolocation' in navigator)) return this.simularUbicacion(true);
    this.buscando.set(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        this.buscando.set(false);
        this.ubicacion.set({ lat: p.coords.latitude, lng: p.coords.longitude, precision: Math.round(p.coords.accuracy), simulada: false });
      },
      () => {
        this.buscando.set(false);
        this.avisos.add({ severity: 'info', summary: 'Ubicación no disponible', detail: 'Usa los botones de simulación.', life: 3500 });
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  protected simularUbicacion(enOficina: boolean) {
    this.ubicacion.set(
      enOficina
        ? { lat: OFICINA.lat + 0.0003, lng: OFICINA.lng + 0.0002, precision: 12, simulada: true }
        : { lat: -14.0889, lng: -75.7633, precision: 18, simulada: true },
    );
  }

  protected tomarSelfie(ev: Event) {
    const f = (ev.target as HTMLInputElement).files?.[0];
    if (f?.type.startsWith('image/')) this.selfie.set(URL.createObjectURL(f));
  }

  protected marcarGps() {
    const z = this.zona();
    if (!z?.ok) return this.error(z ? z.texto : 'Primero obtén tu ubicación.');
    if (this.sim.horario().selfie && !this.selfie()) return this.error('Toma tu selfie para confirmar que eres tú.');
    this.registrar('gps', z.lugar, true);
  }

  protected marcarCodigo() {
    if (this.codigoEscrito.trim() !== this.codigo()) return this.error('Código incorrecto o vencido. Escribe el que ves ahora en la tablet.');
    this.registrar('qr', OFICINA.nombre, true);
    this.codigoEscrito = '';
  }

  protected marcarManual() {
    if (this.motivoManual.trim().length < 5) return this.error('El supervisor debe escribir el motivo (queda registrado).');
    this.registrar('manual', 'Registrado por el supervisor', false, this.motivoManual.trim());
    this.motivoManual = '';
  }

  private registrar(metodo: MetodoMarca, lugar: string, dentroDeZona: boolean, motivoManual?: string) {
    const r = this.sim.marcar(this.trabajadorId(), { metodo, lugar, dentroDeZona, motivoManual });
    if (r === 'ya') return this.error('Ya marcó entrada y salida hoy.');
    const m = this.sim.marcaDe(this.trabajadorId());
    this.avisos.add({
      severity: 'success',
      summary: r === 'entrada' ? `Entrada registrada · ${m?.entrada}` : `Salida registrada · ${m?.salida}`,
      detail: `${this.trabajador()?.nombre} · ${lugar}`,
      life: 4000,
    });
    this.selfie.set(null);
  }

  private error(texto: string) {
    this.avisos.add({ severity: 'warn', summary: 'No se pudo marcar', detail: texto, life: 4500 });
  }
}
