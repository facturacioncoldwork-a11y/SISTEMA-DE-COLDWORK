import { bootstrapApplication } from '@angular/platform-browser';
import { crearAppConfig } from './app/app.config';
import { App } from './app/app';
import { cargarConfig, getConfig } from './app/core/config/runtime-config';

// Primero se lee /config.json (URL y key de Supabase) y luego arranca Angular.
cargarConfig()
  .then(() => {
    // Despierta el backend mientras Angular arranca (si estaba dormido, gana unos segundos)
    void fetch(`${getConfig().apiUrl}/health`, { cache: 'no-store' }).catch(() => undefined);
    return bootstrapApplication(App, crearAppConfig());
  })
  .catch((err) => {
    console.error(err);
    document.body.innerHTML = `<div style="font-family:system-ui;padding:2rem;color:#b91c1c">
      <h2>COLDWORK no pudo iniciar</h2><p>${String(err?.message ?? err)}</p></div>`;
  });
