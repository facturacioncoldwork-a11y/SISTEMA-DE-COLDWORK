import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { map } from 'rxjs';
import { mensajeError } from '../../../../core/api/errores';
import { EmpresaActualService } from '../../../../core/empresa/services/empresa-actual.service';
import { EmpresasService } from '../../../empresas/services/empresas.service';
import { dinero, hoy } from '../../../finanzas/utils/calculos';
import type { Cotizacion, LineaCot } from '../../models/cotizacion.model';
import { CotizacionesStore } from '../../services/cotizaciones-store.service';
import { ServiciosStore } from '../../services/servicios-store.service';
import { hitosConMonto, problemasCotizacion, subtotalSeccion, sumaHitos, totalesCotizacion, totalLinea, venceEl } from '../../utils/cotizacion';

const UNIDADES = ['UND.', 'GLB.', 'SERV.', 'M', 'ML', 'KG', 'JGO.', 'SIS.'];

/** Editor de una cotización (formato COLD WORK) y su paso a servicio cuando el cliente aprueba. */
@Component({
  selector: 'app-cotizacion',
  imports: [FormsModule, RouterLink, DialogModule],
  templateUrl: './cotizacion.html',
  styleUrl: './cotizacion.scss',
})
export class CotizacionView {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly avisos = inject(MessageService);
  private readonly empresa = inject(EmpresaActualService);
  private readonly empresasApi = inject(EmpresasService);
  protected readonly sim = inject(CotizacionesStore);
  protected readonly servicios = inject(ServiciosStore);

  protected readonly unidades = UNIDADES;
  protected readonly totalLinea = totalLinea;
  protected readonly subtotalSeccion = subtotalSeccion;

  private readonly id = toSignal(this.ruta.paramMap.pipe(map((p) => p.get('id') ?? '')), { initialValue: '' });
  /** Copia de trabajo: se edita aquí y se guarda con "Guardar". */
  protected readonly c = signal<Cotizacion | null>(null);
  protected readonly cambios = signal(false);
  protected readonly verCostos = signal(false);
  protected readonly editable = computed(() => this.c()?.estado === 'borrador');

  protected readonly totales = computed(() => (this.c() ? totalesCotizacion(this.c()!) : null));
  protected readonly hitos = computed(() => (this.c() && this.totales() ? hitosConMonto(this.c()!.hitos, this.totales()!.total) : []));
  protected readonly suma = computed(() => sumaHitos(this.c()?.hitos ?? []));
  protected readonly vence = computed(() => (this.c() ? venceEl(this.c()!) : ''));
  protected readonly vencida = computed(() => this.c()?.estado === 'enviada' && this.vence() < hoy());

  // Diálogos
  protected readonly dialogoAprobar = signal(false);
  protected readonly dialogoRechazo = signal(false);
  protected ocNumero = '';
  protected motivo = '';
  protected readonly generando = signal(false);
  protected readonly ocupado = signal(false);

  constructor() {
    effect(() => {
      const id = this.id();
      // Si se abre por enlace directo, la lista llega de la base un momento después
      this.sim.cotizaciones();
      untracked(() => {
        if (this.c()?.id === id && this.cambios()) return;
        const original = this.sim.cotizacion(id);
        this.c.set(original ? structuredClone(original) : null);
        this.cambios.set(false);
      });
    });
  }

  protected dinero(n: number) {
    return dinero(n, this.c()?.moneda ?? 'PEN');
  }

  /** Aplica un cambio a la copia de trabajo. */
  protected editar(fn: (c: Cotizacion) => void) {
    const c = this.c();
    if (!c || !this.editable()) return;
    const copia = structuredClone(c);
    fn(copia);
    this.c.set(copia);
    this.cambios.set(true);
  }

  protected campo<K extends keyof Cotizacion>(k: K, v: Cotizacion[K]) {
    this.editar((c) => (c[k] = v));
  }

  protected linea(si: number, li: number, cambios: Partial<LineaCot>) {
    this.editar((c) => Object.assign(c.secciones[si].lineas[li], cambios));
  }

  protected tituloSeccion(si: number, titulo: string) {
    this.editar((c) => (c.secciones[si].titulo = titulo));
  }

  protected agregarLinea(si: number) {
    this.editar((c) => c.secciones[si].lineas.push({ id: crypto.randomUUID(), descripcion: '', unidad: 'UND.', cantidad: 1, precio: 0, costo: null }));
  }

  protected quitarLinea(si: number, li: number) {
    this.editar((c) => c.secciones[si].lineas.splice(li, 1));
  }

  protected agregarSeccion() {
    this.editar((c) =>
      c.secciones.push({ id: crypto.randomUUID(), titulo: 'Nueva sección', lineas: [{ id: crypto.randomUUID(), descripcion: '', unidad: 'GLB.', cantidad: 1, precio: 0, costo: null }] }),
    );
  }

  protected quitarSeccion(si: number) {
    this.editar((c) => c.secciones.splice(si, 1));
  }

  protected hito(i: number, cambios: { descripcion?: string; porcentaje?: number }) {
    this.editar((c) => Object.assign(c.hitos[i], cambios));
  }

  protected agregarHito() {
    this.editar((c) => c.hitos.push({ id: crypto.randomUUID(), descripcion: 'Nuevo pago', porcentaje: Math.max(0, 100 - sumaHitos(c.hitos)) }));
  }

  protected quitarHito(i: number) {
    this.editar((c) => c.hitos.splice(i, 1));
  }

  /** Corre una acción contra la base mostrando el error si falla. */
  private async conServidor(accion: () => Promise<void>): Promise<boolean> {
    if (this.ocupado()) return false;
    this.ocupado.set(true);
    try {
      await accion();
      return true;
    } catch (e) {
      this.avisos.add({ severity: 'error', summary: 'No se pudo guardar', detail: mensajeError(e) ?? 'Revisa tu conexión.', life: 6000 });
      return false;
    } finally {
      this.ocupado.set(false);
    }
  }

  protected async guardar() {
    const c = this.c();
    if (!c) return;
    if (await this.conServidor(() => this.sim.guardar(c))) {
      this.cambios.set(false);
      this.avisos.add({ severity: 'success', summary: 'Cotización guardada', life: 2500 });
    }
  }

  protected async enviar() {
    const c = this.c();
    if (!c) return;
    const p = problemasCotizacion(c);
    if (p.length) {
      this.avisos.add({ severity: 'warn', summary: 'Antes de enviar', detail: p.join(' '), life: 6000 });
      return;
    }
    const ok = await this.conServidor(async () => {
      await this.sim.guardar({ ...c, fecha: hoy() });
      await this.sim.cambiarEstado(c.id, 'enviada');
    });
    this.recargar();
    if (ok) this.avisos.add({ severity: 'success', summary: 'Marcada como enviada', detail: 'Descarga el PDF y envíaselo al cliente.', life: 4000 });
  }

  protected async volverABorrador() {
    const c = this.c();
    if (!c) return;
    await this.conServidor(() => this.sim.cambiarEstado(c.id, 'borrador'));
    this.recargar();
  }

  protected async aprobar() {
    const c = this.c();
    if (!c || !this.ocNumero.trim()) return;
    let exp: string | null = null;
    const ok = await this.conServidor(async () => {
      exp = await this.sim.aprobar(c.id, this.ocNumero.trim());
    });
    if (!ok) return;
    this.dialogoAprobar.set(false);
    this.avisos.add({ severity: 'success', summary: 'Cotización aprobada', detail: 'Se abrió el servicio con su forma de pago.', life: 4000 });
    if (exp) void this.router.navigate(['/proyectos/servicios', exp]);
  }

  protected async rechazar() {
    const c = this.c();
    if (!c) return;
    const ok = await this.conServidor(() => this.sim.cambiarEstado(c.id, 'rechazada', this.motivo.trim() || 'Sin motivo'));
    if (ok) this.dialogoRechazo.set(false);
    this.recargar();
  }

  protected async descargarPdf() {
    const c = this.c();
    if (!c) return;
    this.generando.set(true);
    try {
      const [{ descargarCotizacionPdf: generar }, empresa] = await Promise.all([
        import('../../services/cotizacion-pdf'),
        this.empresasApi.actual().catch(() => null),
      ]);
      const e = this.empresa.actual();
      await generar({
        cotizacion: c,
        cliente: this.servicios.cliente(c.clienteId),
        empresa: { razonSocial: empresa?.razonSocial ?? e?.razonSocial ?? '', ruc: empresa?.ruc ?? e?.ruc ?? null, direccion: empresa?.direccion },
        datos: this.sim.datosPdf(),
      });
    } catch {
      this.avisos.add({ severity: 'error', summary: 'No se pudo generar el PDF', life: 4000 });
    } finally {
      this.generando.set(false);
    }
  }

  private recargar() {
    const original = this.sim.cotizacion(this.id());
    this.c.set(original ? structuredClone(original) : null);
    this.cambios.set(false);
  }

  protected fechaPe(f: string) {
    return f ? f.split('-').reverse().join('/') : '';
  }
}
