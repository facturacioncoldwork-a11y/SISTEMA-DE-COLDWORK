/**
 * Reglas para adjuntar comprobantes (seguridad: solo tipos y tamaños esperados).
 * El backend repetirá esta validación antes de guardar el archivo.
 */

export const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
export const TAMANO_MAXIMO = 5 * 1024 * 1024; // 5 MB
export const MAXIMO_ADJUNTOS = 3;

/** Devuelve el motivo por el que el archivo no se acepta, o null si está bien. */
export function problemaArchivo(archivo: { name: string; type: string; size: number }, yaAdjuntos: number): string | null {
  if (yaAdjuntos >= MAXIMO_ADJUNTOS) return `Máximo ${MAXIMO_ADJUNTOS} archivos por asiento.`;
  if (!(TIPOS_PERMITIDOS as readonly string[]).includes(archivo.type)) {
    return `"${archivo.name}" no es una foto (JPG, PNG, WEBP) ni un PDF.`;
  }
  if (archivo.size > TAMANO_MAXIMO) return `"${archivo.name}" pesa más de 5 MB.`;
  return null;
}

/** 2048 → "2 KB". */
export function pesoLegible(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
