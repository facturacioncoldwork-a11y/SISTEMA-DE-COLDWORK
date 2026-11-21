import { inject } from '@angular/core';
import { ConfirmationService } from 'primeng/api';

/**
 * Confirmación antes de borrar. Usa el <p-confirmdialog> del contenedor del módulo.
 * Uso:  private readonly confirmar = usarConfirmacion();  if (await this.confirmar('¿Eliminar?', '…')) …
 */
export function usarConfirmacion() {
  const servicio = inject(ConfirmationService);
  return (titulo: string, mensaje: string, boton = 'Sí, eliminar'): Promise<boolean> =>
    new Promise((ok) =>
      servicio.confirm({
        header: titulo,
        message: mensaje,
        icon: 'pi pi-trash',
        acceptLabel: boton,
        rejectLabel: 'Cancelar',
        acceptButtonProps: { severity: 'danger' },
        rejectButtonProps: { severity: 'secondary', text: true },
        accept: () => ok(true),
        reject: () => ok(false),
      }),
    );
}
