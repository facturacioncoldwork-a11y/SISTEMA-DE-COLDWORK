import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { mensajeError } from '../../../../core/api/errores';
import { EmpresaActualService } from '../../../../core/empresa/services/empresa-actual.service';
import { DatosEmpresa } from '../../../servicios/services/datos-empresa.service';
import { AsistenciaApi, type Tableta } from '../../services/asistencia-api.service';

/**
 * Encargados de asistencia y tabletas de la oficina.
 *  · Encargado: quien tiene el área "Personal" (la da el dueño en Equipo y accesos).
 *  · Tablet: se autoriza con un enlace de un solo uso; queda mostrando el código que cambia cada
 *    30 s, sin iniciar sesión y sin acceso a nada más. Se desactiva con un clic.
 */
@Component({
  selector: 'app-tabletas',
  imports: [FormsModule, RouterLink, DatePipe],
  template: `
    <div class="rejilla">
      <section class="lg-card">
        <div class="lg-card__head"><div><h3>Encargados de asistencia</h3><p>Ven a todos, aprueban marcas y manejan las tabletas</p></div></div>
        <ul class="lista">
          @for (p of encargados(); track p.usuarioId) {
            <li><span class="lg-avatar">{{ iniciales(p.nombre) }}</span><span><b>{{ p.nombre }}</b><small>{{ p.rol === 'dueno' ? 'Dueño' : p.rol === 'admin' ? 'Administración' : 'Área Personal' }}</small></span></li>
          }
        </ul>
        <p class="nota">
          Para nombrar a alguien encargado, dale el área <b>Personal</b> en
          @if (empresa.esDueno()) {
            <a routerLink="/equipo">Equipo y accesos</a>.
          } @else {
            Equipo y accesos (lo hace el dueño).
          }
          Los demás solo marcan su propia asistencia.
        </p>
      </section>

      <section class="lg-card">
        <div class="lg-card__head"><div><h3>Tabletas de la oficina</h3><p>Muestran el código que cambia cada 30 segundos</p></div></div>
        @if (enlace(); as e) {
          <div class="enlace">
            <p><i class="pi pi-check-circle"></i> <b>Abre este enlace en la tablet</b> (solo una vez; luego queda guardado en ella):</p>
            <code>{{ e }}</code>
            <div class="botones">
              <button type="button" class="lg-cta" (click)="copiar(e)"><i class="pi pi-copy"></i> Copiar enlace</button>
              <button type="button" class="lg-cta lg-cta--suave" (click)="enlace.set(null)">Listo</button>
            </div>
            <small>Por seguridad no se volverá a mostrar. Si lo pierdes, desactiva la tablet y crea otra.</small>
          </div>
        } @else {
          <form class="nueva" (ngSubmit)="crear()">
            <input name="nombre" maxlength="60" placeholder="Nombre (ej. Tablet de la entrada)" [(ngModel)]="nombre" />
            <button type="submit" class="lg-cta" [disabled]="creando()"><i class="pi pi-tablet"></i> Autorizar tablet</button>
          </form>
        }
        <ul class="lista">
          @for (t of tabletas(); track t.id) {
            <li [class.apagada]="!t.activa">
              <i class="pi pi-tablet"></i>
              <span class="crece"><b>{{ t.nombre }}</b><small>{{ t.activa ? (t.ultimoUso ? 'Vista por última vez ' + (t.ultimoUso | date: 'dd/MM HH:mm') : 'Aún no se abre') : 'Desactivada' }}</small></span>
              @if (t.activa) {
                <button type="button" class="lg-cta lg-cta--suave chico" (click)="desactivar(t)">Desactivar</button>
              }
            </li>
          } @empty {
            <li class="vacia">Aún no hay tabletas. Cualquier tablet o celular viejo con internet sirve.</li>
          }
        </ul>
      </section>
    </div>
  `,
  styles: `
    .rejilla { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; margin-top: 1rem; align-items: start; }
    @media (max-width: 900px) { .rejilla { grid-template-columns: 1fr; } }
    .lista { list-style: none; margin: 0.5rem 0 0; padding: 0; }
    .lista li { display: flex; gap: 0.7rem; align-items: center; padding: 0.55rem 0; border-top: 1px solid var(--lg-line); }
    .lista b { display: block; font-size: 0.88rem; }
    .lista small { color: var(--lg-muted); font-size: 0.76rem; }
    .apagada { opacity: 0.55; }
    .crece { flex: 1; min-width: 0; }
    .vacia { color: var(--lg-muted); font-size: 0.85rem; }
    .nota { font-size: 0.82rem; color: var(--lg-muted); margin: 0.8rem 0 0; }
    .nueva { display: flex; gap: 0.5rem; }
    .nueva input { flex: 1; padding: 0.55rem; border: 1px solid var(--lg-line); border-radius: 0.6rem; font: inherit; }
    .enlace { display: grid; gap: 0.5rem; padding: 0.8rem; border-radius: 0.8rem; background: #ecfdf5; border: 1px solid #a7f3d0; }
    .enlace p { margin: 0; font-size: 0.86rem; }
    .enlace code { word-break: break-all; font-size: 0.75rem; background: #fff; padding: 0.5rem; border-radius: 0.5rem; }
    .enlace small { color: var(--lg-muted); font-size: 0.76rem; }
    .botones { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .chico { padding: 0.3rem 0.6rem; font-size: 0.78rem; }
  `,
})
export class Tabletas implements OnInit {
  private readonly api = inject(AsistenciaApi);
  private readonly datos = inject(DatosEmpresa);
  private readonly avisos = inject(MessageService);
  protected readonly empresa = inject(EmpresaActualService);

  protected readonly tabletas = signal<Tableta[]>([]);
  protected readonly enlace = signal<string | null>(null);
  protected readonly creando = signal(false);
  protected nombre = '';

  protected readonly encargados = computed(() => this.datos.conArea('personal'));

  async ngOnInit() {
    await this.cargar();
  }

  private async cargar() {
    this.tabletas.set(await this.api.tabletas().catch(() => []));
  }

  protected async crear() {
    const nombre = this.nombre.trim();
    if (!nombre) return this.aviso('warn', 'Ponle un nombre a la tablet', 'Ej. Tablet de la entrada.');
    this.creando.set(true);
    try {
      const r = await this.api.crearTableta(nombre);
      this.enlace.set(`${location.origin}/tableta#t=${r.token}`);
      this.nombre = '';
      await this.cargar();
    } catch (e) {
      this.aviso('error', 'No se pudo autorizar la tablet', mensajeError(e) ?? '');
    } finally {
      this.creando.set(false);
    }
  }

  protected async desactivar(t: Tableta) {
    try {
      await this.api.desactivarTableta(t.id);
      await this.cargar();
      this.aviso('success', `${t.nombre} desactivada`, 'Ya no muestra el código.');
    } catch (e) {
      this.aviso('error', 'No se pudo desactivar', mensajeError(e) ?? '');
    }
  }

  protected async copiar(texto: string) {
    await navigator.clipboard.writeText(texto).catch(() => undefined);
    this.aviso('success', 'Enlace copiado', 'Ábrelo en la tablet (por WhatsApp a ti mismo o escribiéndolo).');
  }

  protected iniciales(n: string) {
    return n.split(' ').map((p) => p[0]).slice(0, 2).join('');
  }

  private aviso(severity: 'success' | 'warn' | 'error', summary: string, detail: string) {
    this.avisos.add({ severity, summary, detail, life: 4500 });
  }
}
