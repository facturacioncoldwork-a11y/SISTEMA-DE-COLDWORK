import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { getConfig } from '../../../../core/config/runtime-config';

const CLAVE = 'coldwork-tableta';

interface Respuesta {
  codigo: string;
  segundos: number;
  empresa: string;
  tableta: string;
}

/**
 * Pantalla de la TABLET de la oficina (sin iniciar sesión). Se abre una vez con el enlace que
 * genera el encargado de asistencia; el token queda guardado solo en esta tablet y se quita de
 * la dirección. Muestra el código que cambia cada 30 s: el trabajador lo escribe en SU celular.
 * Sin el token no muestra nada, y el encargado puede desactivarla cuando quiera.
 */
@Component({
  selector: 'app-tableta',
  template: `
    <main class="tablet" [class.error]="!!error()">
      @if (error(); as e) {
        <div class="centro">
          <i class="pi pi-lock"></i>
          <h1>Tablet no autorizada</h1>
          <p>{{ e }}</p>
          <p class="pie">Pide al encargado de asistencia un enlace nuevo (Asistencia → Horario y métodos → Tabletas).</p>
        </div>
      } @else if (datos(); as d) {
        <header>
          <span class="empresa">{{ d.empresa }}</span>
          <span class="reloj">{{ hora() }}</span>
        </header>
        <div class="centro">
          <p class="titulo">Código de asistencia</p>
          <span class="codigo">{{ d.codigo.slice(0, 3) }} {{ d.codigo.slice(3) }}</span>
          <div class="barra"><span [style.width.%]="(segundos() / 30) * 100"></span></div>
          <p class="cuenta">Cambia en {{ segundos() }} s</p>
        </div>
        <footer>
          <ol>
            <li>Abre <b>COLDWORK</b> en tu celular</li>
            <li>Entra a <b>Marcar asistencia</b> → <b>Código de oficina</b></li>
            <li>Escribe este número y toca <b>Marcar</b></li>
          </ol>
          <div class="acciones">
            <span class="nombre">{{ d.tableta }}</span>
            <button type="button" (click)="pantallaCompleta()"><i class="pi pi-window-maximize"></i> Pantalla completa</button>
          </div>
        </footer>
      } @else {
        <div class="centro"><i class="pi pi-spin pi-spinner"></i></div>
      }
    </main>
  `,
  styles: `
    :host { display: block; }
    .tablet { min-height: 100dvh; display: grid; grid-template-rows: auto 1fr auto; padding: 2rem 2.5rem; box-sizing: border-box;
      color: #fff; background: radial-gradient(circle at 20% 10%, #1e3a8a, #0b1220 60%); font-family: inherit; }
    .tablet.error { background: #1f2937; grid-template-rows: 1fr; }
    header { display: flex; justify-content: space-between; align-items: center; font-size: 1.3rem; opacity: 0.9; }
    .empresa { font-weight: 700; letter-spacing: 0.02em; }
    .reloj { font-variant-numeric: tabular-nums; font-size: 1.6rem; }
    .centro { display: grid; place-items: center; align-content: center; gap: 1rem; text-align: center; }
    .centro > i { font-size: 3rem; opacity: 0.8; }
    .titulo { margin: 0; font-size: 1.4rem; text-transform: uppercase; letter-spacing: 0.2em; opacity: 0.75; }
    .codigo { font-size: clamp(5rem, 18vw, 13rem); font-weight: 800; letter-spacing: 0.06em; font-variant-numeric: tabular-nums; line-height: 1; }
    .barra { width: min(32rem, 80vw); height: 0.6rem; border-radius: 999px; background: rgb(255 255 255 / 0.15); overflow: hidden; }
    .barra span { display: block; height: 100%; background: linear-gradient(90deg, #22d3ee, #6366f1); transition: width 1s linear; }
    .cuenta { margin: 0; font-size: 1.2rem; opacity: 0.8; }
    footer { display: flex; justify-content: space-between; align-items: end; gap: 1rem; flex-wrap: wrap; }
    ol { margin: 0; padding-left: 1.3rem; font-size: 1.1rem; line-height: 1.8; opacity: 0.9; }
    .acciones { display: grid; gap: 0.5rem; justify-items: end; }
    .nombre { opacity: 0.6; font-size: 0.9rem; }
    button { font: inherit; color: #fff; background: rgb(255 255 255 / 0.12); border: 1px solid rgb(255 255 255 / 0.25);
      border-radius: 0.7rem; padding: 0.55rem 0.9rem; cursor: pointer; display: inline-flex; gap: 0.4rem; align-items: center; }
    h1 { margin: 0; }
    .pie { opacity: 0.7; max-width: 32rem; }
  `,
})
export class Tableta implements OnInit {
  protected readonly datos = signal<Respuesta | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly segundos = signal(30);
  private readonly ahora = signal(new Date());
  protected readonly hora = computed(() => this.ahora().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }));
  private token: string | null = null;
  private pidiendo = false;
  private bloqueo: { release(): Promise<void> } | null = null;

  constructor() {
    const id = setInterval(() => this.tic(), 1000);
    const alVolver = () => document.visibilityState === 'visible' && void this.pedir();
    document.addEventListener('visibilitychange', alVolver);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', alVolver);
      void this.bloqueo?.release();
    });
  }

  ngOnInit() {
    // El enlace trae el token en "#t=…" (no viaja al servidor ni queda en el historial)
    const delEnlace = new URLSearchParams(location.hash.slice(1)).get('t');
    if (delEnlace && /^[0-9a-f]{64}$/.test(delEnlace)) {
      localStorage.setItem(CLAVE, delEnlace);
      history.replaceState(null, '', location.pathname);
    }
    this.token = localStorage.getItem(CLAVE);
    if (!this.token) {
      this.error.set('Esta tablet aún no tiene permiso para mostrar el código.');
      return;
    }
    void this.pedir();
    void this.mantenerEncendida();
  }

  private tic() {
    this.ahora.set(new Date());
    if (!this.datos()) return;
    const s = this.segundos() - 1;
    if (s > 0) this.segundos.set(s);
    else void this.pedir();
  }

  private async pedir() {
    if (!this.token || this.pidiendo) return;
    this.pidiendo = true;
    try {
      const r = await fetch(`${getConfig().apiUrl}/v1/tableta/codigo`, { headers: { 'X-Tableta-Token': this.token } });
      if (r.status === 401 || r.status === 403) {
        localStorage.removeItem(CLAVE);
        this.error.set('El encargado desactivó esta tablet o el enlace ya no es válido.');
        return;
      }
      if (!r.ok) throw new Error(String(r.status));
      const d = (await r.json()) as Respuesta;
      this.datos.set(d);
      this.segundos.set(Math.max(1, d.segundos));
    } catch {
      // Sin internet: se reintenta en unos segundos
      this.segundos.set(5);
    } finally {
      this.pidiendo = false;
    }
  }

  /** Que la pantalla no se apague mientras está en la entrada (si el navegador lo permite). */
  private async mantenerEncendida() {
    try {
      const wl = (navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } }).wakeLock;
      this.bloqueo = (await wl?.request('screen')) ?? null;
    } catch {
      this.bloqueo = null;
    }
  }

  protected pantallaCompleta() {
    void document.documentElement.requestFullscreen?.().catch(() => undefined);
    void this.mantenerEncendida();
  }
}
