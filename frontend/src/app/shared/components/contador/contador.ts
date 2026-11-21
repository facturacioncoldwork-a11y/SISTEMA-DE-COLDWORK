import { DecimalPipe } from '@angular/common';
import { Component, effect, input, OnDestroy, signal } from '@angular/core';

/** Número que sube animado desde 0 hasta su valor (respeta "reducir movimiento"). */
@Component({
  selector: 'app-contador',
  imports: [DecimalPipe],
  template: `{{ prefijo() }}{{ actual() | number: formato() }}`,
})
export class Contador implements OnDestroy {
  readonly valor = input(0);
  readonly formato = input('1.0-0');
  readonly prefijo = input('');
  readonly duracion = input(900);
  protected readonly actual = signal(0);
  private cuadro = 0;

  constructor() {
    effect(() => {
      const fin = this.valor();
      const dur = this.duracion();
      cancelAnimationFrame(this.cuadro);
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return this.actual.set(fin);
      const ini = performance.now();
      const paso = (t: number) => {
        const k = Math.min(1, (t - ini) / dur);
        this.actual.set(fin * (1 - Math.pow(1 - k, 3)));
        if (k < 1) this.cuadro = requestAnimationFrame(paso);
      };
      this.cuadro = requestAnimationFrame(paso);
    });
  }

  ngOnDestroy() {
    cancelAnimationFrame(this.cuadro);
  }
}
