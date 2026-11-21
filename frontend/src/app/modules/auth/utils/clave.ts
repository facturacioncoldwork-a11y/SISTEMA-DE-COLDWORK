/**
 * Reglas de contraseña al crear una cuenta (seguridad básica recomendada).
 * Supabase también exige su mínimo en el servidor.
 */
export const CLAVE_MINIMA = 8;

/** Devuelve lo que le falta a la contraseña, o una lista vacía si está bien. */
export function problemasClave(clave: string, repetida: string): string[] {
  const problemas: string[] = [];
  if (clave.length < CLAVE_MINIMA) problemas.push(`Usa al menos ${CLAVE_MINIMA} caracteres.`);
  if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(clave) || !/\d/.test(clave)) problemas.push('Combina letras y números.');
  if (clave !== repetida) problemas.push('Las dos contraseñas no coinciden.');
  return problemas;
}
