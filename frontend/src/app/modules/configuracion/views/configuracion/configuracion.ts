import { Component, computed, effect, inject, OnInit, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { mensajeError } from '../../../../core/api/errores';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { EmpresaActualService } from '../../../../core/empresa/services/empresa-actual.service';
import type { Empresa } from '../../../empresas/models/empresa.model';
import { EmpresasService } from '../../../empresas/services/empresas.service';
import { ConfigEmpresaService, type ConfigEmpresa, type CuentaBancaria } from '../../services/config-empresa.service';

const RUC = /^(10|15|17|20)\d{9}$/;

/**
 * Sistema → Configuración (dueño y administradores): datos de la empresa, contacto, cuentas
 * bancarias que salen en las cotizaciones, valores por defecto de las cotizaciones y seguridad.
 */
@Component({
  selector: 'app-configuracion',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="lg">
      <header class="lg-hero">
        <div class="lg-hero__fila">
          <div>
            <div class="lg-hero__miga"><i class="pi pi-cog"></i> Sistema</div>
            <h1 class="lg-hero__titulo">Configuración</h1>
            <p class="lg-hero__sub">Datos de tu empresa, cuentas bancarias y cómo salen tus cotizaciones.</p>
          </div>
        </div>
      </header>

      <div class="lg-cuerpo">
        @if (!listo()) {
          <div class="lg-vacio"><i class="pi pi-spin pi-spinner"></i><h4>Cargando…</h4></div>
        } @else {
          <form class="rejilla" (ngSubmit)="guardar()">
            <section class="lg-card">
              <div class="lg-card__head"><div><h3>Datos de la empresa</h3><p>Salen en cotizaciones, órdenes de compra e informes</p></div></div>
              <div class="lg-form">
                <div class="full"><label for="c-rs">Razón social</label><input id="c-rs" name="rs" maxlength="200" [(ngModel)]="e.razonSocial" /></div>
                <div><label for="c-ruc">RUC</label><input id="c-ruc" name="ruc" inputmode="numeric" maxlength="11" [(ngModel)]="e.ruc" /></div>
                <div><label for="c-nc">Nombre comercial</label><input id="c-nc" name="nc" maxlength="120" [(ngModel)]="e.nombreComercial" /></div>
                <div class="full"><label for="c-dir">Dirección fiscal</label><input id="c-dir" name="dir" maxlength="250" [(ngModel)]="e.direccion" /></div>
                <div><label for="c-tel">Teléfono</label><input id="c-tel" name="tel" maxlength="30" [(ngModel)]="c.telefono" /></div>
                <div><label for="c-mail">Correo de contacto</label><input id="c-mail" name="mail" type="email" maxlength="120" [(ngModel)]="c.correo" /></div>
                <div class="full"><label for="c-web">Página web</label><input id="c-web" name="web" maxlength="120" placeholder="www.tuempresa.com" [(ngModel)]="c.web" /></div>
              </div>
            </section>

            <section class="lg-card">
              <div class="lg-card__head"><div><h3>Cotizaciones</h3><p>Valores con los que empieza cada cotización nueva</p></div></div>
              <div class="lg-form">
                <div><label for="c-pre">Prefijo del número</label><input id="c-pre" name="pre" maxlength="8" [(ngModel)]="c.cotPrefijo" (ngModelChange)="c.cotPrefijo = $event.toUpperCase()" /></div>
                <div><span class="etiqueta">Así se verá</span><p class="ejemplo">{{ ejemplo() }}</p></div>
                <div><label for="c-vp">Validez de proyectos (días)</label><input id="c-vp" name="vp" type="number" min="1" max="365" [(ngModel)]="c.cotValidezProy" /></div>
                <div><label for="c-vs">Validez de servicios (días)</label><input id="c-vs" name="vs" type="number" min="1" max="365" [(ngModel)]="c.cotValidezServ" /></div>
                <div><label for="c-det">Detracción habitual (%)</label><input id="c-det" name="det" type="number" min="0" max="100" step="0.5" [(ngModel)]="c.cotDetraccion" /></div>
                <div><label for="c-oc">Correo para recibir órdenes</label><input id="c-oc" name="oc" type="email" maxlength="120" [(ngModel)]="c.correoOrdenes" /></div>
                <div class="full"><label for="c-not">Notas que van en el PDF</label><textarea id="c-not" name="not" rows="3" maxlength="1000" [(ngModel)]="c.cotNotas"></textarea></div>
              </div>
              <p class="nota">La detracción la confirma tu contador: 12 % para servicios y 4 % para construcción (SPOT, SUNAT).</p>
            </section>

            <section class="lg-card full">
              <div class="lg-card__head">
                <div><h3>Cuentas bancarias</h3><p>Salen en las cotizaciones para que el cliente pague</p></div>
                <button type="button" class="lg-cta lg-cta--suave" (click)="agregarCuenta()" [disabled]="c.cuentas.length >= 10"><i class="pi pi-plus"></i> Agregar cuenta</button>
              </div>
              @for (cu of c.cuentas; track $index; let i = $index) {
                <div class="cuenta">
                  <input [name]="'b' + i" maxlength="60" placeholder="Banco (ej. BCP)" [(ngModel)]="cu.banco" aria-label="Banco" />
                  <select [name]="'m' + i" [(ngModel)]="cu.moneda" aria-label="Moneda"><option value="PEN">Soles</option><option value="USD">Dólares</option></select>
                  <input [name]="'n' + i" maxlength="30" inputmode="numeric" placeholder="N.° de cuenta" [(ngModel)]="cu.numero" aria-label="Número de cuenta" />
                  <input [name]="'c' + i" maxlength="20" inputmode="numeric" placeholder="CCI (20 dígitos)" [(ngModel)]="cu.cci" aria-label="CCI" />
                  <button type="button" class="quitar" (click)="quitarCuenta(i)" aria-label="Quitar cuenta"><i class="pi pi-trash"></i></button>
                </div>
              } @empty {
                <p class="nota">Aún no hay cuentas. Agrega la cuenta en soles y, si cobras en dólares, también esa.</p>
              }
            </section>

            <div class="full barra">
              @if (error(); as er) {
                <p class="error"><i class="pi pi-exclamation-circle"></i> {{ er }}</p>
              }
              <span class="espacio"></span>
              @if (!puedeEditar()) {
                <small class="nota">Solo el dueño o un administrador pueden cambiar la configuración.</small>
              }
              <button type="submit" class="lg-cta" [disabled]="guardando() || !puedeEditar()"><i [class]="guardando() ? 'pi pi-spin pi-spinner' : 'pi pi-check'"></i> Guardar cambios</button>
            </div>
          </form>

          <div class="rejilla">
            <section class="lg-card">
              <div class="lg-card__head"><div><h3>Seguridad</h3><p>Tu cuenta y tus sesiones</p></div></div>
              <ul class="puntos">
                <li><i class="pi pi-shield"></i> Cada persona ve solo las áreas que le das; la base de datos lo exige aunque alguien intente saltarse la pantalla.</li>
                <li><i class="pi pi-lock"></i> Las marcas de asistencia, los informes firmados y el historial no se pueden borrar ni editar.</li>
                <li><i class="pi pi-eye-slash"></i> Las fotos de los informes y los datos de ubicación son privados de tu empresa (Ley 29733).</li>
              </ul>
              <button type="button" class="lg-cta lg-cta--suave" (click)="salirDeTodo()"><i class="pi pi-sign-out"></i> Cerrar sesión en todos los dispositivos</button>
              <p class="nota">Úsalo si perdiste tu celular o entraste desde una computadora ajena.</p>
            </section>

            <section class="lg-card">
              <div class="lg-card__head"><div><h3>Personas y accesos</h3><p>Quién entra y a qué áreas</p></div></div>
              <p class="texto">Invita a tu personal por correo y dale solo las áreas que necesita: contabilidad, finanzas, ventas, logística, área técnica o personal (asistencia).</p>
              @if (empresa.esDueno()) {
                <a class="lg-cta" routerLink="/equipo"><i class="pi pi-users"></i> Ir a Equipo y accesos</a>
              } @else {
                <p class="nota">Los accesos los da el dueño de la empresa.</p>
              }
            </section>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    .rejilla { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; align-items: start; margin-bottom: 1rem; }
    .full { grid-column: 1 / -1; }
    @media (max-width: 900px) { .rejilla { grid-template-columns: 1fr; } }
    input, select, textarea { width: 100%; padding: 0.55rem; border: 1px solid var(--lg-line); border-radius: 0.6rem; font: inherit; background: #fff; }
    .etiqueta { display: block; font-size: 0.82rem; font-weight: 600; color: var(--lg-muted); }
    .ejemplo { margin: 0; padding: 0.55rem 0; font-family: ui-monospace, monospace; font-weight: 600; }
    .nota { font-size: 0.8rem; color: var(--lg-muted); margin: 0.6rem 0 0; }
    .texto { font-size: 0.88rem; margin: 0 0 0.8rem; }
    .cuenta { display: grid; grid-template-columns: 1.2fr 0.8fr 1.3fr 1.5fr auto; gap: 0.5rem; padding: 0.45rem 0; border-top: 1px solid var(--lg-line); }
    @media (max-width: 760px) { .cuenta { grid-template-columns: 1fr 1fr; } }
    .quitar { border: 0; background: transparent; color: var(--lg-danger); cursor: pointer; padding: 0 0.5rem; }
    .barra { display: flex; gap: 0.8rem; align-items: center; flex-wrap: wrap; }
    .espacio { flex: 1; }
    .error { color: var(--lg-danger); margin: 0; font-size: 0.86rem; }
    .puntos { list-style: none; margin: 0 0 0.9rem; padding: 0; display: grid; gap: 0.55rem; font-size: 0.85rem; }
    .puntos li { display: flex; gap: 0.55rem; }
    .puntos i { color: var(--lg-blue); margin-top: 0.15rem; }
  `,
})
export class Configuracion implements OnInit {
  private readonly empresasApi = inject(EmpresasService);
  private readonly configSvc = inject(ConfigEmpresaService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly avisos = inject(MessageService);
  protected readonly empresa = inject(EmpresaActualService);

  /** Copias de trabajo (se guardan con "Guardar cambios"). */
  protected e: Pick<Empresa, 'razonSocial' | 'ruc' | 'nombreComercial' | 'direccion'> = { razonSocial: '', ruc: '', nombreComercial: '', direccion: '' };
  protected c: ConfigEmpresa = structuredClone(this.configSvc.config());
  private original: Empresa | null = null;

  private readonly empresaLista = signal(false);
  protected readonly listo = computed(() => this.empresaLista() && this.configSvc.cargada());
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly puedeEditar = this.empresa.esAdmin;
  private readonly prefijo = signal(this.c.cotPrefijo);
  protected readonly ejemplo = computed(() => `${this.prefijo() || 'COT-'}PROY${new Date().getFullYear()}00001`);

  constructor() {
    // Cuando llega la configuración guardada, el formulario la muestra
    effect(() => {
      const cfg = this.configSvc.config();
      untracked(() => {
        this.c = structuredClone(cfg);
        this.prefijo.set(cfg.cotPrefijo);
      });
    });
  }

  async ngOnInit() {
    try {
      this.original = await this.empresasApi.actual();
      this.e = {
        razonSocial: this.original.razonSocial,
        ruc: this.original.ruc ?? '',
        nombreComercial: this.original.nombreComercial ?? '',
        direccion: this.original.direccion ?? '',
      };
    } finally {
      this.empresaLista.set(true);
    }
  }

  protected agregarCuenta() {
    this.c.cuentas = [...this.c.cuentas, { banco: '', moneda: 'PEN', numero: '', cci: '' } satisfies CuentaBancaria];
  }

  protected quitarCuenta(i: number) {
    this.c.cuentas = this.c.cuentas.filter((_, j) => j !== i);
  }

  private validar(): string | null {
    if (this.e.razonSocial.trim().length < 2) return 'Escribe la razón social.';
    if (this.e.ruc && !RUC.test(this.e.ruc.trim())) return 'El RUC tiene 11 dígitos y empieza con 10, 15, 17 o 20.';
    if (!/^[A-Z0-9-]{1,8}$/.test(this.c.cotPrefijo)) return 'Prefijo: solo mayúsculas, números y guion (máximo 8).';
    for (const cu of this.c.cuentas) {
      if (cu.banco.trim().length < 2) return 'Indica el banco de cada cuenta.';
      if (!/^[0-9][0-9 -]{4,28}[0-9]$/.test(cu.numero.trim())) return `Revisa el número de cuenta de ${cu.banco || 'la cuenta'}.`;
      if (cu.cci && !/^\d{20}$/.test(cu.cci.trim())) return `El CCI de ${cu.banco || 'la cuenta'} debe tener 20 dígitos.`;
    }
    return null;
  }

  protected async guardar() {
    const er = this.validar();
    this.error.set(er);
    if (er) return;
    this.guardando.set(true);
    try {
      const cambios = {
        razonSocial: this.e.razonSocial.trim(),
        ruc: this.e.ruc?.trim() || undefined,
        nombreComercial: this.e.nombreComercial?.trim() ?? '',
        direccion: this.e.direccion?.trim() ?? '',
      };
      await Promise.all([
        this.empresasApi.actualizar(cambios),
        this.configSvc.guardar({ ...this.c, cuentas: this.c.cuentas.map((x) => ({ ...x, banco: x.banco.trim(), numero: x.numero.trim(), cci: x.cci.trim() })) }),
      ]);
      // El nombre de la empresa sale en el menú: se refresca la lista
      if (this.original?.razonSocial !== cambios.razonSocial) await this.empresa.recargar();
      this.prefijo.set(this.c.cotPrefijo);
      this.avisos.add({ severity: 'success', summary: 'Configuración guardada', life: 3000 });
    } catch (e) {
      this.error.set(mensajeError(e) ?? 'No se pudo guardar. Revisa tu conexión.');
    } finally {
      this.guardando.set(false);
    }
  }

  protected async salirDeTodo() {
    await this.auth.salirDeTodo();
    this.empresa.limpiar();
    void this.router.navigateByUrl('/login');
  }
}
