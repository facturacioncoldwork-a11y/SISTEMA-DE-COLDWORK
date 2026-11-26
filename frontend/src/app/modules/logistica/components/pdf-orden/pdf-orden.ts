import { Component, effect, inject, input, model, signal } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { EmpresaActualService } from '../../../../core/empresa/services/empresa-actual.service';
import type { OrdenCompra } from '../../models/logistica.model';
import { LogisticaStore, mensajeError } from '../../services/logistica-store.service';
import { crearPdfOrden, type DatosOrdenPdf } from '../../services/orden-pdf';
import { VistaPdf } from '../vista-pdf/vista-pdf';

/** Datos del PDF a partir de una orden guardada. */
export function datosPdfDe(
  o: OrdenCompra,
  empresa?: { razonSocial: string; ruc: string | null } | null,
): DatosOrdenPdf {
  return {
    codigo: o.codigo,
    aprobada: o.estado === 'enviada' || o.estado === 'parcial' || o.estado === 'recibida',
    fecha: o.fecha,
    fechaEntrega: o.entregaHasta,
    moneda: o.moneda,
    proveedor: {
      razonSocial: o.proveedor.razonSocial,
      ruc: o.proveedor.numeroDocumento,
      direccion: o.proveedor.direccion,
    },
    atencion: o.atencion,
    condicionesPago: o.condicionesPago,
    solicitadoPor: o.solicitadoPor,
    lugarEntrega: o.lugarEntrega,
    cotizacionRef: o.cotizacionRef,
    proyecto: o.proyecto?.codigo ?? null,
    items: o.items.map((i) => ({
      codigo: i.sku,
      descripcion: i.nombre,
      cantidad: i.cantidad,
      unidad: i.unidad,
      precio: i.costoUnitario,
    })),
    empresa: empresa ?? undefined,
  };
}

/** PDF de una orden ya guardada: vista previa y descarga. */
@Component({
  selector: 'app-pdf-orden',
  imports: [DialogModule, VistaPdf],
  template: `
    <p-dialog
      [(visible)]="visible"
      [modal]="true"
      [draggable]="false"
      [maximizable]="true"
      [style]="{ width: 'min(56rem, 97vw)' }"
      [header]="'Orden de compra ' + (orden()?.codigo ?? '')"
    >
      <div class="hoja"><app-vista-pdf [bytes]="bytes()" /></div>
      <div class="lg-pie-dialogo">
        @if (orden()?.estado === 'borrador') {
          <span class="nota"
            ><i class="pi pi-info-circle"></i> Sale como BORRADOR hasta que la envíes al
            proveedor.</span
          >
        }
        <span style="flex: 1"></span>
        <button type="button" class="lg-cta lg-cta--suave" (click)="visible.set(false)">
          Cerrar
        </button>
        <button type="button" class="lg-cta" [disabled]="!bytes()" (click)="descargar()">
          <i class="pi pi-download"></i> Descargar PDF
        </button>
      </div>
    </p-dialog>
  `,
  styles: `
    .hoja {
      background: #e9eef5;
      border-radius: 1rem;
      padding: 1rem;
      max-height: 68vh;
      overflow: auto;
    }
    .nota {
      font-size: 0.8rem;
      color: var(--lg-muted);
      display: inline-flex;
      gap: 0.4rem;
      align-items: center;
    }
  `,
})
export class PdfOrden {
  private readonly empresa = inject(EmpresaActualService);
  private readonly store = inject(LogisticaStore);
  readonly visible = model(false);
  readonly orden = input<OrdenCompra | null>(null);
  protected readonly bytes = signal<ArrayBuffer | null>(null);
  private guardar: (() => void) | null = null;

  constructor() {
    effect(() => {
      const o = this.orden();
      if (!this.visible() || !o) return;
      this.bytes.set(null);
      const e = this.empresa.actual();
      crearPdfOrden(datosPdfDe(o, e ? { razonSocial: e.razonSocial, ruc: e.ruc } : null)).then(
        (r) => {
          this.bytes.set(r.bytes);
          this.guardar = r.guardar;
        },
        (err: unknown) => this.store.error('No se pudo generar el PDF', mensajeError(err) ?? err),
      );
    });
  }

  protected descargar() {
    this.guardar?.();
  }
}
