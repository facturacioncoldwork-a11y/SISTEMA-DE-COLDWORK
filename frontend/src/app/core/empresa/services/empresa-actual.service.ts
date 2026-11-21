import { computed, inject, Injectable, signal } from '@angular/core';
import { ApiService } from '../../api/services/api.service';
import { veTodo, type Area } from '../../permisos/areas';
import type { MiEmpresa } from '../../../modules/empresas/models/empresa.model';

/** Última empresa usada en este dispositivo: se entra directo a ella la próxima vez. */
const CLAVE = 'coldwork-empresa';

/**
 * Empresa con la que se está trabajando (se recuerda entre visitas) y lo que
 * el usuario puede ver en ella (rol + áreas).
 */
@Injectable({ providedIn: 'root' })
export class EmpresaActualService {
  private readonly api = inject(ApiService);

  readonly empresas = signal<MiEmpresa[]>([]);
  private readonly elegidaId = signal<string | null>(localStorage.getItem(CLAVE));
  /** Id de la última empresa elegida (puede ya no existir si le quitaron el acceso). */
  readonly ultimaElegida = this.elegidaId.asReadonly();
  private carga: Promise<MiEmpresa[]> | null = null;

  readonly actual = computed(() => {
    const lista = this.empresas();
    return lista.find((e) => e.id === this.elegidaId()) ?? lista[0] ?? null;
  });
  readonly id = computed(() => this.actual()?.id ?? null);
  readonly rol = computed(() => this.actual()?.rol ?? null);
  /** Dueño o admin: ve todas las áreas y gestiona el equipo. */
  readonly esAdmin = computed(() => veTodo(this.rol()));

  /** ¿Puede entrar a esta área en la empresa actual? */
  puede(area: Area): boolean {
    const e = this.actual();
    return !!e && (veTodo(e.rol) || e.areas.includes(area));
  }

  /**
   * Trae "mis empresas" del backend una sola vez (lo usan el shell y los guards).
   * El backend acepta ahí las invitaciones pendientes del usuario.
   */
  asegurar(): Promise<MiEmpresa[]> {
    this.carga ??= this.api.get<MiEmpresa[]>('/empresas/mias').then(
      (lista) => {
        this.empresas.set(lista);
        return lista;
      },
      (e: unknown) => {
        this.carga = null; // permite reintentar
        throw e;
      },
    );
    return this.carga;
  }

  /** Vuelve a pedir la lista (ej. después de crear una empresa). */
  recargar(): Promise<MiEmpresa[]> {
    this.carga = null;
    return this.asegurar();
  }

  /** Fija la lista a mano (pruebas). */
  cargar(lista: MiEmpresa[]) {
    this.empresas.set(lista);
    this.carga = Promise.resolve(lista);
  }

  elegir(id: string) {
    this.elegidaId.set(id);
    localStorage.setItem(CLAVE, id);
  }

  limpiar() {
    this.empresas.set([]);
    this.carga = null;
    // La última empresa elegida se recuerda en el dispositivo: no es un dato sensible
    // y si otra cuenta entra aquí, no le sirve (se le pregunta).
  }
}
