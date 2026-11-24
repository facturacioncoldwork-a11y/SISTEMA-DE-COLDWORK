import { ApplicationConfig, provideBrowserGlobalErrorListeners, LOCALE_ID } from '@angular/core';
import { PreloadAllModules, provideRouter, withComponentInputBinding, withPreloading } from '@angular/router';
import { registerLocaleData } from '@angular/common';
import localeEsPE from '@angular/common/locales/es-PE';
import { providePrimeNG } from 'primeng/config';
import { MessageService } from 'primeng/api';
import { ColdworkPreset } from './core/theme/coldwork-preset';
import { routes } from './app.routes';
import { getConfig } from './core/config/runtime-config';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { apiInterceptor } from './core/api/interceptors/api.interceptor';

registerLocaleData(localeEsPE);

/** Se llama DESPUÉS de leer config.json (ver main.ts). */
export const crearAppConfig = (): ApplicationConfig => ({
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Los módulos se descargan en segundo plano apenas carga la app: al abrirlos ya están listos
    provideRouter(routes, withComponentInputBinding(), withPreloading(PreloadAllModules)),
    provideHttpClient(withFetch(), withInterceptors([apiInterceptor])),
    { provide: LOCALE_ID, useValue: 'es-PE' },
    providePrimeNG({
      // Licencia de PrimeUI (PrimeNG 22+). Va en config.json -> primeLicense.
      license: getConfig().primeLicense || undefined,
      theme: { preset: ColdworkPreset, options: { darkModeSelector: '.dark' } },
      translation: {
        accept: 'Aceptar',
        reject: 'Cancelar',
        emptyMessage: 'Sin resultados',
        emptyFilterMessage: 'Sin resultados',
      },
    }),
    MessageService,
  ],
});
