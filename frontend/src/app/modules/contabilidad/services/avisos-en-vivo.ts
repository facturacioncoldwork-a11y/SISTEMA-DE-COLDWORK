import { effect, inject, untracked } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ContabilidadService } from './contabilidad.service';

/**
 * Muestra un aviso cuando OTRA persona hace algo (aprobar, enviar, observar…).
 * La actividad llega en vivo por Supabase Realtime. Llamar en el constructor de un layout.
 */
export function usarAvisosEnVivo(): void {
  const conta = inject(ContabilidadService);
  const avisos = inject(MessageService);
  let ultimaVista: string | null | undefined; // undefined = aún no cargó nada

  effect(() => {
    const ultima = conta.actividad()[0];
    if (!conta.cargado()) return;
    const yo = untracked(() => conta.persona());

    // Primera carga: solo recuerda dónde está, sin avisar de lo antiguo
    if (ultimaVista === undefined) {
      ultimaVista = ultima?.id ?? null;
      return;
    }
    if (!ultima || ultima.id === ultimaVista) return;
    ultimaVista = ultima.id;
    if (ultima.personaId === yo.id) return;

    avisos.add({
      severity: ultima.accion === 'observo' ? 'warn' : 'info',
      icon: 'pi pi-bell',
      summary: untracked(() => conta.describir(ultima.personaId, ultima.accion)),
      detail: `Asiento ${String(ultima.numero).padStart(4, '0')} · ${ultima.glosa}`,
      life: 6000,
    });
  });
}
