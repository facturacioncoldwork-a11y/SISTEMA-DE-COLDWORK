import { signal } from '@angular/core';

/**
 * Guardado en segundo plano: la pantalla cambia al instante y el cambio viaja a la base de datos
 * un momento después (agrupando teclas seguidas en una sola petición). Por cada registro los
 * guardados van en fila, así la versión siempre es la última y no se pisan.
 */
export class ColaGuardado {
  private readonly temporizadores = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly cadenas = new Map<string, Promise<void>>();
  /** Guardados en curso o por enviar (para avisar antes de cerrar la pestaña). */
  readonly pendientes = signal(0);

  constructor(
    private readonly alFallar: (error: unknown) => void,
    private readonly espera = 700,
  ) {}

  /** Programa el guardado de un registro; si llega otro cambio antes, se manda solo el último. */
  programar(id: string, tarea: () => Promise<void>) {
    const previo = this.temporizadores.get(id);
    if (previo) clearTimeout(previo);
    else this.pendientes.update((n) => n + 1);
    this.temporizadores.set(
      id,
      setTimeout(() => {
        this.temporizadores.delete(id);
        this.pendientes.update((n) => n - 1);
        void this.ahora(id, tarea).catch(() => undefined);
      }, this.espera),
    );
  }

  /** Guarda ya (después de lo que esté en fila para ese registro). Devuelve la promesa para esperar el resultado. */
  ahora(id: string, tarea: () => Promise<void>): Promise<void> {
    const previo = this.temporizadores.get(id);
    if (previo) {
      clearTimeout(previo);
      this.temporizadores.delete(id);
      this.pendientes.update((n) => n - 1);
    }
    this.pendientes.update((n) => n + 1);
    const p = (this.cadenas.get(id) ?? Promise.resolve())
      .catch(() => undefined)
      .then(tarea)
      .catch((e: unknown) => {
        this.alFallar(e);
        throw e;
      })
      .finally(() => this.pendientes.update((n) => n - 1));
    this.cadenas.set(id, p);
    return p;
  }
}
