import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { map } from 'rxjs';
import { EmpresaActualService } from '../../../../core/empresa/services/empresa-actual.service';
import { dinero, hoy } from '../../../finanzas/utils/calculos';
import type { Cotizacion, LineaCot } from '../../models/cotizacion.model';
import { CotizacionesSim, DATOS_COTIZACION } from '../../services/cotizaciones-sim.service';
import { ServiciosSim } from '../../services/servicios-sim.service';
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
  protected readonly sim = inject(CotizacionesSim);
  protected readonly servicios = inject(ServiciosSim);

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

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => {
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

  protected guardar() {
    const c = this.c();
    if (!c) return;
    this.sim.guardar(c);
    this.cambios.set(false);
    this.avisos.add({ severity: 'success', summary: 'Cotización guardada', life: 2500 });
  }

  protected enviar() {
    const c = this.c();
    if (!c) return;
    const p = problemasCotizacion(c);
    if (p.length) {
      this.avisos.add({ severity: 'warn', summary: 'Antes de enviar', detail: p.join(' '), life: 6000 });
      return;
    }
    this.sim.guardar({ ...c, fecha: hoy() });
    this.sim.cambiarEstado(c.id, 'enviada');
    this.recargar();
    this.avisos.add({ severity: 'success', summary: 'Marcada como enviada', detail: 'Descarga el PDF y envíaselo al cliente.', life: 4000 });
  }

  protected volverABorrador() {
    const c = this.c();
    if (!c) return;
    this.sim.cambiarEstado(c.id, 'borrador');
    this.recargar();
  }

  protected aprobar() {
    const c = this.c();
    if (!c || !this.ocNumero.trim()) return;
    const exp = this.sim.aprobar(c.id, this.ocNumero.trim());
    this.dialogoAprobar.set(false);
    this.avisos.add({ severity: 'success', summary: 'Cotización aprobada', detail: 'Se abrió el servicio con su forma de pago.', life: 4000 });
    if (exp) void this.router.navigate(['/proyectos/servicios', exp]);
  }

  protected rechazar() {
    const c = this.c();
    if (!c) return;
    this.sim.cambiarEstado(c.id, 'rechazada', this.motivo.trim() || 'Sin motivo');
    this.dialogoRechazo.set(false);
    this.recargar();
  }

  protected async descargarPdf() {
    const c = this.c();
    if (!c) return;
    this.generando.set(true);
    try {
      const { descargarCotizacionPdf } = await import('../../services/cotizacion-pdf');
      const e = this.empresa.actual();
      await descargarCotizacionPdf({
        cotizacion: c,
        cliente: this.servicios.cliente(c.clienteId),
        empresa: { razonSocial: e?.razonSocial ?? 'COLD WORK S.A.C.', ruc: e?.ruc ?? null },
        datos: DATOS_COTIZACION,
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
