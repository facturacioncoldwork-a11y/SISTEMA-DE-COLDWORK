import { computed, Injectable, signal } from '@angular/core';
import { ASIENTOS_EJEMPLO } from '../data/ejemplo';
import { PCGE } from '../data/pcge';
import type { Asiento, Cuenta, NuevoAsiento, Regimen, TramoIngresos } from '../models/contabilidad.model';
import { validarAsiento } from '../utils/partida-doble';

/**
 * Estado del módulo Contabilidad.
 *
 * PROTOTIPO: los asientos viven en memoria (se pierden al recargar) para revisar
 * el diseño. Cuando se apruebe, estos métodos llamarán al backend (/api/v1/contabilidad)
 * con la misma forma, sin cambiar las vistas.
 */
@Injectable({ providedIn: 'root' })
export class ContabilidadService {
  // ─── Plan de cuentas ──────────────────────────────────────────
  readonly cuentas: Cuenta[] = PCGE;
  readonly porCodigo: ReadonlyMap<string, Cuenta> = new Map(PCGE.map((c) => [c.codigo, c]));
  readonly cuentasMovimiento = PCGE.filter((c) => c.movimiento);

  // ─── Configuración tributaria (luego vendrá de la empresa) ───────
  readonly regimen = signal<Regimen>('rmt');
  readonly tramo = signal<TramoIngresos>('hasta300');

  // ─── Periodo y asientos ───────────────────────────────────────
  readonly periodo = signal('2026-11');
  private readonly todos = signal<Asiento[]>(structuredClone(ASIENTOS_EJEMPLO));

  /** Asientos del periodo elegido, del más reciente al más antiguo. */
  readonly asientos = computed(() =>
    this.todos()
      .filter((a) => a.periodo === this.periodo())
      .sort((a, b) => b.numero - a.numero),
  );

  readonly periodos = computed(() => {
    const lista = new Set(this.todos().map((a) => a.periodo));
    lista.add(this.periodo());
    return [...lista].sort().reverse();
  });

  nombreCuenta(codigo: string): string {
    return this.porCodigo.get(codigo)?.nombre ?? '';
  }

  /** Crea el asiento como borrador o lo registra directamente. */
  crear(datos: NuevoAsiento, registrar: boolean): Asiento {
    if (registrar) {
      const errores = validarAsiento(datos, this.porCodigo);
      if (errores.length) throw new Error(errores[0]);
    }

    const periodo = datos.fecha.slice(0, 7);
    const asiento: Asiento = {
      ...datos,
      lineas: datos.lineas.filter((l) => l.cuenta),
      id: crypto.randomUUID(),
      numero: this.siguienteNumero(periodo),
      periodo,
      estado: registrar ? 'registrado' : 'borrador',
      creadoEn: new Date().toISOString(),
    };
    this.todos.update((lista) => [...lista, asiento]);
    return asiento;
  }

  /** Pasa un borrador a registrado (desde ahí ya no se edita: se corrige con otro asiento). */
  registrar(id: string): void {
    const asiento = this.buscar(id);
    const errores = validarAsiento(asiento, this.porCodigo);
    if (errores.length) throw new Error(errores[0]);
    this.cambiarEstado(id, 'registrado');
  }

  /** Anula sin borrar: el número queda en el libro para no romper el correlativo. */
  anular(id: string): void {
    this.cambiarEstado(id, 'anulado');
  }

  eliminarBorrador(id: string): void {
    if (this.buscar(id).estado !== 'borrador') throw new Error('Solo se eliminan borradores.');
    this.todos.update((lista) => lista.filter((a) => a.id !== id));
  }

  // ─── Internos ────────────────────────────────────────────────

  private buscar(id: string): Asiento {
    const asiento = this.todos().find((a) => a.id === id);
    if (!asiento) throw new Error('El asiento no existe.');
    return asiento;
  }

  private cambiarEstado(id: string, estado: Asiento['estado']): void {
    this.todos.update((lista) => lista.map((a) => (a.id === id ? { ...a, estado } : a)));
  }

  private siguienteNumero(periodo: string): number {
    const numeros = this.todos()
      .filter((a) => a.periodo === periodo)
      .map((a) => a.numero);
    return Math.max(0, ...numeros) + 1;
  }
}
