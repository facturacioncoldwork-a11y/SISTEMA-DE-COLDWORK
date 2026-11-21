import { Component, computed, effect, input, signal } from '@angular/core';
import { fuentesEmoji, type NombreIcono } from './iconos';

/**
 * Sticker/emoji como IMAGEN POR LINK (nunca como carácter Unicode: así se ve
 * igual en Windows, Android, iPhone y al imprimir).
 *
 * Si una fuente no carga, prueba la siguiente (Noto animado → Twemoji → copia
 * local). Si ninguna carga, no muestra nada (nunca un ícono roto).
 *
 * Uso:  <app-emoji nombre="saludo" />           (catálogo, ver iconos.ts)
 *       <app-emoji url="https://…/sticker.gif" nombre="estrella" />  (cualquier link)
 */
@Component({
  selector: 'app-emoji',
  template: `
    @if (src(); as s) {
      <img
        [src]="s"
        [alt]="etiqueta()"
        [attr.aria-hidden]="etiqueta() ? null : 'true'"
        draggable="false"
        (error)="siguiente()"
      />
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      vertical-align: -0.15em;
    }
    img {
      width: var(--tam, 1.1em);
      height: var(--tam, 1.1em);
      object-fit: contain;
    }
  `,
})
export class Emoji {
  readonly nombre = input<NombreIcono>();
  /** Link de cualquier página (gif, png, svg, webp). */
  readonly url = input<string>();
  readonly etiqueta = input('');

  private readonly intento = signal(0);
  private readonly fuentes = computed(() => {
    const n = this.nombre();
    return [...(this.url() ? [this.url()!] : []), ...(n ? fuentesEmoji(n) : [])];
  });
  protected readonly src = computed(() => this.fuentes()[this.intento()] ?? null);

  constructor() {
    // Si cambia el emoji, vuelve a empezar por la primera fuente
    effect(() => {
      this.fuentes();
      this.intento.set(0);
    });
  }

  protected siguiente() {
    this.intento.update((i) => i + 1);
  }
}
