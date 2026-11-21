import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { necesitaElegir } from '../empresa/eleccion';
import { EmpresaActualService } from '../empresa/services/empresa-actual.service';
import type { Area } from './areas';
import { portalDe, RUTA_PORTAL, type Portal } from './portales';

/**
 * Protege una ruta por área: `canActivate: [conArea('ventas')]`.
 * Sin acceso → vuelve al inicio. (El backend también lo exige con @RequiereArea.)
 */
export const conArea =
  (area: Area): CanActivateFn =>
  async () => {
    const empresa = inject(EmpresaActualService);
    const router = inject(Router);
    await empresa.asegurar().catch(() => []);
    return empresa.puede(area) ? true : router.createUrlTree(['/'], { queryParams: { sinAcceso: area } });
  };

/**
 * En el ERP (shell): quien tiene un portal propio es llevado a él.
 * Así un contador nunca ve el menú ni los módulos del dueño, aunque escriba la dirección.
 */
export const alPortalCorrecto: CanActivateFn = async (_ruta, estado) => {
  // Crear su propia empresa está permitido para cualquiera (ahí será dueño)
  if (estado.url.startsWith('/empresa/nueva')) return true;

  const empresa = inject(EmpresaActualService);
  const router = inject(Router);
  await empresa.asegurar().catch(() => []);
  const e = empresa.actual();
  const portal = portalDe(e?.rol, e?.areas);
  return portal === 'erp' ? true : router.createUrlTree([RUTA_PORTAL[portal]]);
};

/**
 * Con varias empresas se entra directo a la última usada.
 * Solo si no hay una última válida se pregunta a cuál entrar.
 */
export const conEmpresaElegida: CanActivateFn = async (_ruta, estado) => {
  if (estado.url.startsWith('/empresa/nueva')) return true;

  const empresa = inject(EmpresaActualService);
  const router = inject(Router);
  const lista = await empresa.asegurar().catch(() => []);
  return necesitaElegir(lista, empresa.ultimaElegida()) ? router.createUrlTree(['/elegir-empresa']) : true;
};

/** Entrada a un portal: su dueño natural, o dueño/admin para supervisar. */
export const conPortal =
  (portal: Portal): CanActivateFn =>
  async () => {
    const empresa = inject(EmpresaActualService);
    const router = inject(Router);
    await empresa.asegurar().catch(() => []);
    const e = empresa.actual();
    return empresa.esAdmin() || portalDe(e?.rol, e?.areas) === portal ? true : router.createUrlTree(['/']);
  };

/** Solo dueño y admin (Equipo, Configuración). */
export const soloAdmin: CanActivateFn = async () => {
  const empresa = inject(EmpresaActualService);
  const router = inject(Router);
  await empresa.asegurar().catch(() => []);
  return empresa.esAdmin() ? true : router.createUrlTree(['/']);
};
