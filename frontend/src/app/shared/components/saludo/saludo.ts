import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, input, signal } from '@angular/core';
import { Emoji } from '../emoji/emoji';
import type { NombreIcono } from '../emoji/iconos';

/**
 * Saludo grande con color y sticker según la hora (mismo estilo que el Inicio del sistema).
 * Uso:  <app-saludo nombre="María" [chips]="['COLDWORK', 'Contadora']" />
 */
@Component({
  selector: 'app-saludo',
  imports: [DatePipe, Emoji],
  templateUrl: './saludo.html',
  styleUrl: './saludo.scss',
})
export class Saludo {
  readonly nombre = input('');
  /** Etiquetas debajo del saludo (empresa, rol, áreas…). */
  readonly chips = input<string[]>([]);

  protected readonly ahora = signal(new Date());

  /** Mañana / tarde / noche: cambia saludo, color y sticker. */
  protected readonly momento = computed(() => {
    const h = this.ahora().getHours();
    if (h >= 5 && h < 12) return { saludo: 'Buenos días', sticker: 'sol' as NombreIcono, clase: 'manana' };
    if (h >= 12 && h < 19) return { saludo: 'Buenas tardes', sticker: 'saludo' as NombreIcono, clase: 'tarde' };
    return { saludo: 'Buenas noches', sticker: 'luna' as NombreIcono, clase: 'noche' };
  });

  constructor() {
    const reloj = setInterval(() => this.ahora.set(new Date()), 30_000);
    inject(DestroyRef).onDestroy(() => clearInterval(reloj));
  }
}
