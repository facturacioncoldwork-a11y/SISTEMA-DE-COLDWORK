import { AfterViewInit, Component, ElementRef, output, viewChild } from '@angular/core';

/** Firma con el dedo (celular) o el mouse. Emite la imagen PNG al soltar. */
@Component({
  selector: 'app-firma',
  template: `
    <div class="caja">
      <canvas #lienzo (pointerdown)="empezar($event)" (pointermove)="mover($event)" (pointerup)="terminar()" (pointerleave)="terminar()"></canvas>
      <span class="linea">Firma del cliente</span>
      <button type="button" class="borrar" (click)="limpiar()" aria-label="Borrar firma"><i class="pi pi-eraser"></i> Borrar</button>
    </div>
  `,
  styles: `
    .caja { position: relative; border: 1.5px dashed var(--lg-line); border-radius: 0.9rem; background: #fff; }
    canvas { display: block; width: 100%; height: 11rem; touch-action: none; cursor: crosshair; }
    .linea { position: absolute; left: 1rem; right: 1rem; bottom: 1.6rem; border-top: 1px solid #cbd5e1; font-size: 0.72rem;
      color: var(--lg-muted); padding-top: 0.2rem; pointer-events: none; }
    .borrar { position: absolute; top: 0.5rem; right: 0.5rem; border: 0; background: var(--lg-soft); border-radius: 0.5rem;
      padding: 0.3rem 0.55rem; font: inherit; font-size: 0.78rem; cursor: pointer; color: var(--lg-muted); }
  `,
})
export class Firma implements AfterViewInit {
  readonly firmada = output<string | null>();
  private readonly lienzo = viewChild.required<ElementRef<HTMLCanvasElement>>('lienzo');
  private ctx!: CanvasRenderingContext2D;
  private dibujando = false;
  private trazo = false;

  ngAfterViewInit() {
    const c = this.lienzo().nativeElement;
    const escala = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * escala;
    c.height = c.offsetHeight * escala;
    this.ctx = c.getContext('2d')!;
    this.ctx.scale(escala, escala);
    this.ctx.lineWidth = 2.2;
    this.ctx.lineCap = 'round';
    this.ctx.strokeStyle = '#0b1b2b';
  }

  protected empezar(e: PointerEvent) {
    this.dibujando = true;
    this.ctx.beginPath();
    this.ctx.moveTo(e.offsetX, e.offsetY);
  }

  protected mover(e: PointerEvent) {
    if (!this.dibujando) return;
    this.ctx.lineTo(e.offsetX, e.offsetY);
    this.ctx.stroke();
    this.trazo = true;
  }

  protected terminar() {
    if (!this.dibujando) return;
    this.dibujando = false;
    if (this.trazo) this.firmada.emit(this.lienzo().nativeElement.toDataURL('image/png'));
  }

  protected limpiar() {
    const c = this.lienzo().nativeElement;
    this.ctx.clearRect(0, 0, c.width, c.height);
    this.trazo = false;
    this.firmada.emit(null);
  }
}
