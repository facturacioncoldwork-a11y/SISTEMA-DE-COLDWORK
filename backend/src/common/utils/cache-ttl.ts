/**
 * Memoria corta en el proceso (clave → valor que vence a los `ttlMs`).
 * Para datos que se consultan en CADA petición y cambian poco (ej. el rol del usuario
 * en la empresa). Evita ir a la base de datos una y otra vez.
 *
 * - Tiene tope de entradas: al llenarse descarta la más antigua (no crece sin límite).
 * - Es por instancia: con varias copias del servidor cada una tiene la suya (sin estado compartido).
 */
export class CacheTtl<T> {
  private readonly datos = new Map<string, { valor: T; vence: number }>();

  constructor(
    private readonly ttlMs: number,
    private readonly maximo = 5000,
    private readonly ahora: () => number = Date.now,
  ) {}

  obtener(clave: string): T | undefined {
    const entrada = this.datos.get(clave);
    if (!entrada) return undefined;
    if (entrada.vence <= this.ahora()) {
      this.datos.delete(clave);
      return undefined;
    }
    return entrada.valor;
  }

  guardar(clave: string, valor: T): void {
    if (this.datos.size >= this.maximo && !this.datos.has(clave)) {
      const masAntigua = this.datos.keys().next().value;
      if (masAntigua !== undefined) this.datos.delete(masAntigua);
    }
    this.datos.delete(clave); // reinsertar = queda como la más nueva
    this.datos.set(clave, { valor, vence: this.ahora() + this.ttlMs });
  }

  /** Borra las claves que empiezan con `prefijo` (ej. todo lo de un usuario). */
  olvidar(prefijo: string): void {
    for (const clave of this.datos.keys()) {
      if (clave.startsWith(prefijo)) this.datos.delete(clave);
    }
  }

  get tamano(): number {
    return this.datos.size;
  }
}
