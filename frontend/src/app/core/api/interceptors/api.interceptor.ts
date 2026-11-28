import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { getConfig } from '../../config/runtime-config';
import { SupabaseService } from '../../supabase/services/supabase.service';
import { EmpresaActualService } from '../../empresa/services/empresa-actual.service';

/**
 * A toda petición hacia la API NestJS le agrega:
 *  - Authorization: Bearer <token de Supabase> (renovado automáticamente)
 *  - X-Empresa-Id: empresa elegida
 * Las peticiones a otros dominios no se tocan.
 */
export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  const { apiUrl } = getConfig();
  if (!req.url.startsWith(apiUrl)) return next(req);

  const supabase = inject(SupabaseService);
  const empresa = inject(EmpresaActualService);

  return from(supabase.auth.getSession()).pipe(
    switchMap(({ data }) => {
      const headers: Record<string, string> = {};
      if (data.session) headers['Authorization'] = `Bearer ${data.session.access_token}`;
      const id = empresa.id();
      if (id && !req.headers.has('X-Empresa-Id')) headers['X-Empresa-Id'] = id;
      return next(req.clone({ setHeaders: headers }));
    }),
  );
};
