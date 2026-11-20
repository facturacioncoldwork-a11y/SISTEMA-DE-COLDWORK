import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
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
export const alPortalCorrecto: CanActivateFn = async () => {
  const empresa = inject(EmpresaActualService);
  const router = inject(Router);
  await empresa.asegurar().catch(() => []);
  const e = empresa.actual();
  const portal = portalDe(e?.rol, e?.areas);
  return portal === 'erp' ? true : router.createUrlTree([RUTA_PORTAL[portal]]);
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
