import { computed, inject, Injectable, Injector, signal } from '@angular/core';
import { ApiService } from '../../api/services/api.service';
import { AuthService } from '../../auth/services/auth.service';
import { veTodo, type Area } from '../../permisos/areas';
import type { MiEmpresa } from '../../../modules/empresas/models/empresa.model';

/** Última empresa usada en este dispositivo: se entra directo a ella la próxima vez. */
const CLAVE = 'coldwork-empresa';
/** Lista de "mis empresas" de cada cuenta en este dispositivo (para que el menú salga al instante). */
const CLAVE_LISTA = 'coldwork-mis-empresas';

/**
 * Empresa con la que se está trabajando (se recuerda entre visitas) y lo que
 * el usuario puede ver en ella (rol + áreas).
 */
@Injectable({ providedIn: 'root' })
export class EmpresaActualService {
  private readonly api = inject(ApiService);
  /** La sesión se pide recién al usar la lista guardada (así este servicio no arranca Supabase por su cuenta). */
  private readonly injector = inject(Injector);

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
  /** Dueño (CEO): el único que da accesos. */
  readonly esDueno = computed(() => this.rol() === 'dueno');

  /** ¿Puede entrar a esta área en la empresa actual? */
  puede(area: Area): boolean {
    const e = this.actual();
    return !!e && (veTodo(e.rol) || e.areas.includes(area));
  }

  /**
   * Trae "mis empresas" del backend una sola vez (lo usan el shell y los guards).
   * El backend acepta ahí las invitaciones pendientes del usuario.
   *
   * Arranque rápido: si este dispositivo ya tiene la lista de esta misma cuenta, se usa al
   * instante (el menú aparece sin esperar al servidor) y se confirma en segundo plano.
   * Es solo para pintar la pantalla: los permisos reales los exige siempre el backend.
   */
  asegurar(): Promise<MiEmpresa[]> {
    if (this.carga) return this.carga;
    const pedido = this.api.get<MiEmpresa[]>('/empresas/mias').then(
      (lista) => {
        this.empresas.set(lista);
        this.guardarCache(lista);
        return lista;
      },
      (e: unknown) => {
        this.carga = null; // permite reintentar
        throw e;
      },
    );
    const guardada = this.leerCache();
    if (guardada) {
      this.empresas.set(guardada);
      pedido.catch(() => undefined); // si el servidor tarda o falla, se sigue con lo guardado
      this.carga = Promise.resolve(guardada);
    } else {
      this.carga = pedido;
    }
    return this.carga;
  }

  private claveCache(): string | null {
    const usuario = this.injector.get(AuthService).usuario()?.id;
    return usuario ? `${CLAVE_LISTA}:${usuario}` : null;
  }

  private leerCache(): MiEmpresa[] | null {
    const clave = this.claveCache();
    if (!clave) return null;
    try {
      const lista = JSON.parse(localStorage.getItem(clave) ?? 'null') as unknown;
      return Array.isArray(lista) && lista.length ? (lista as MiEmpresa[]) : null;
    } catch {
      return null;
    }
  }

  private guardarCache(lista: MiEmpresa[]) {
    const clave = this.claveCache();
    if (clave) localStorage.setItem(clave, JSON.stringify(lista));
  }

  /** Vuelve a pedir la lista (ej. después de crear una empresa). */
  recargar(): Promise<MiEmpresa[]> {
    // Siempre al servidor (ej. recién creó una empresa): la lista guardada podría estar desactualizada
    this.carga = this.api.get<MiEmpresa[]>('/empresas/mias').then(
      (lista) => {
        this.empresas.set(lista);
        this.guardarCache(lista);
        return lista;
      },
      (e: unknown) => {
        this.carga = null;
        throw e;
      },
    );
    return this.carga;
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
    // Al cerrar sesión se borran las listas guardadas en el dispositivo (la sesión ya puede no existir)
    Object.keys(localStorage)
      .filter((k) => k.startsWith(`${CLAVE_LISTA}:`))
      .forEach((k) => localStorage.removeItem(k));
    this.empresas.set([]);
    this.carga = null;
    // La última empresa elegida se recuerda en el dispositivo: no es un dato sensible
    // y si otra cuenta entra aquí, no le sirve (se le pregunta).
  }
}
