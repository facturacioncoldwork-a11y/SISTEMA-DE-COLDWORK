/** Copia de un objeto sin ciertas claves (lo que pone el servidor no se le vuelve a mandar). */
export function omitir<T extends object, K extends keyof T>(objeto: T, ...claves: K[]): Omit<T, K> {
  const copia = { ...objeto };
  for (const k of claves) delete copia[k];
  return copia;
}
