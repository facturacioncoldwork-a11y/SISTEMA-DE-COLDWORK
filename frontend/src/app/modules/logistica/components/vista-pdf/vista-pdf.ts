import { Component, effect, ElementRef, input, signal, viewChild } from '@angular/core';

/**
 * Muestra un PDF (bytes) dibujado con pdf.js, página por página.
 * Es el PDF real que se descarga: lo que ves aquí es lo que se imprime.
 */
@Component({
  selector: 'app-vista-pdf',
  template: `
    @if (cargando()) {
      <div class="lg-skel" style="height: 30rem"></div>
    }
    @if (error(); as e) {
      <p class="err"><i class="pi pi-exclamation-triangle"></i> {{ e }}</p>
    }
    <div #hojas class="hojas"></div>
  `,
  styles: `
    :host {
      display: block;
    }
    .hojas {
      display: grid;
      gap: 1rem;
      justify-items: center;
    }
    .hojas ::ng-deep canvas {
      width: 100%;
      max-width: 46rem;
      height: auto;
      background: #fff;
      border-radius: 0.4rem;
      box-shadow:
        0 10px 30px -12px rgb(15 23 42 / 0.35),
        0 0 0 1px #e2e8f0;
    }
    .err {
      color: #dc2626;
      font-size: 0.88rem;
    }
  `,
})
export class VistaPdf {
  readonly bytes = input<ArrayBuffer | null>(null);
  private readonly hojas = viewChild.required<ElementRef<HTMLDivElement>>('hojas');
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);
  private turno = 0;

  constructor() {
    effect(() => {
      const b = this.bytes();
      const caja = this.hojas().nativeElement;
      if (b) void this.dibujar(b, caja);
    });
  }

  private async dibujar(bytes: ArrayBuffer, caja: HTMLDivElement) {
    const mio = ++this.turno;
    this.cargando.set(!caja.childElementCount);
    this.error.set(null);
    try {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs/pdf.worker.min.mjs',
        document.baseURI,
      ).href;
      const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise;
      const lienzos: HTMLCanvasElement[] = [];
      for (let p = 1; p <= doc.numPages; p++) {
        const pagina = await doc.getPage(p);
        const vista = pagina.getViewport({ scale: 2 });
        const c = document.createElement('canvas');
        c.width = vista.width;
        c.height = vista.height;
        await pagina.render({ canvas: c, viewport: vista }).promise;
        lienzos.push(c);
      }
      if (mio !== this.turno) return; // llegó una versión más nueva
      caja.replaceChildren(...lienzos);
    } catch (e) {
      this.error.set('No se pudo mostrar el PDF: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      if (mio === this.turno) this.cargando.set(false);
    }
  }
}
