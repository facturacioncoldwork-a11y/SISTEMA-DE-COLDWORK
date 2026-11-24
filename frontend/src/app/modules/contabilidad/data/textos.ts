import type { AccionActividad, Asiento, EstadoAsiento } from '../models/contabilidad.model';

/** Textos y colores que se muestran en pantalla para estados y acciones. */

type Severidad = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast';

export const ESTADOS: Record<EstadoAsiento, { nombre: string; severidad: Severidad; icono: string }> = {
  borrador: { nombre: 'Borrador', severidad: 'secondary', icono: 'pi pi-pencil' },
  por_aprobar: { nombre: 'Por aprobar', severidad: 'info', icono: 'pi pi-hourglass' },
  observado: { nombre: 'Observado', severidad: 'warn', icono: 'pi pi-exclamation-circle' },
  registrado: { nombre: 'Registrado', severidad: 'success', icono: 'pi pi-check' },
  anulado: { nombre: 'Anulado', severidad: 'danger', icono: 'pi pi-ban' },
};

/** `texto` para otra persona ("María aprobó"); `textoYo` para uno mismo ("Tú aprobaste"). */
export const ACCIONES: Record<AccionActividad, { texto: string; textoYo: string; icono: string }> = {
  creo: { texto: 'creó el borrador', textoYo: 'creaste el borrador', icono: 'pi pi-file-edit' },
  edito: { texto: 'editó', textoYo: 'editaste', icono: 'pi pi-pencil' },
  envio: { texto: 'envió a aprobación', textoYo: 'enviaste a aprobación', icono: 'pi pi-send' },
  aprobo: { texto: 'aprobó', textoYo: 'aprobaste', icono: 'pi pi-check-circle' },
  observo: { texto: 'observó', textoYo: 'observaste', icono: 'pi pi-comment' },
  registro: { texto: 'registró', textoYo: 'registraste', icono: 'pi pi-check' },
  anulo: { texto: 'anuló', textoYo: 'anulaste', icono: 'pi pi-ban' },
  elimino: { texto: 'eliminó el borrador', textoYo: 'eliminaste el borrador', icono: 'pi pi-trash' },
};

/** Mensaje de confirmación después de guardar, según cómo quedó el asiento. */
export function mensajeGuardado(a: Asiento): string {
  switch (a.estado) {
    case 'registrado':
      return `Asiento ${a.numero} registrado`;
    case 'por_aprobar':
      return `Asiento ${a.numero} enviado al dueño para aprobación`;
    default:
      return 'Borrador guardado';
  }
}
