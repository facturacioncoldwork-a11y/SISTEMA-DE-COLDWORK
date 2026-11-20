import { effect, inject, untracked } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ContabilidadService } from './contabilidad.service';

/**
 * Muestra un aviso cuando OTRA persona hace algo (aprobar, enviar, observar…).
 * Llamar en el constructor de un layout. Al conectar Supabase Realtime,
 * la actividad llegará sola y este aviso seguirá funcionando igual.
 */
export function usarAvisosEnVivo(): void {
  const conta = inject(ContabilidadService);
  const avisos = inject(MessageService);
  let primera = true;

  effect(() => {
    const ultima = conta.actividad()[0];
    const yo = untracked(() => conta.persona());

    if (primera) {
      primera = false;
      return;
    }
    if (!ultima || ultima.personaId === yo.id) return;

    avisos.add({
      severity: ultima.accion === 'observo' ? 'warn' : 'info',
      icon: 'pi pi-bell',
      summary: conta.describir(ultima.personaId, ultima.accion),
      detail: `Asiento ${String(ultima.numero).padStart(4, '0')} · ${ultima.glosa}`,
      life: 6000,
    });
  });
}
