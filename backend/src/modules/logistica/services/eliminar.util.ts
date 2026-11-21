import { ConflictException, NotFoundException } from '@nestjs/common';

/**
 * Ejecuta un DELETE real y traduce los errores a mensajes para el usuario:
 *  · no existía → 404
 *  · tiene historial (FK) → 409 con la alternativa (desactivar)
 */
export async function eliminarConMensaje(
  borrar: () => Promise<boolean>,
  queEs: string,
  siTieneHistorial: string,
): Promise<void> {
  try {
    if (!(await borrar()))
      throw new NotFoundException(`${queEs} no existe o ya fue eliminado`);
  } catch (e) {
    if (e instanceof ConflictException)
      throw new ConflictException(siTieneHistorial);
    throw e;
  }
}
