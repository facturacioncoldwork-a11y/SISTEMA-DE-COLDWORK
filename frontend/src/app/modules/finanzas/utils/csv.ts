/**
 * Genera y descarga un CSV que Excel abre bien en español (punto y coma + BOM UTF-8).
 */
export function aCsv(filas: Record<string, unknown>[]): string {
  if (!filas.length) return '';
  const columnas = Object.keys(filas[0]);
  const celda = (v: unknown) => {
    const texto = v === null || v === undefined ? '' : typeof v === 'number' ? String(v) : String(v as string);
    // Evita fórmulas maliciosas (inyección CSV) y escapa comillas
    const seguro = /^[=+\-@]/.test(texto) && typeof v !== 'number' ? `'${texto}` : texto;
    return /[;"\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
  };
  return [columnas.join(';'), ...filas.map((f) => columnas.map((c) => celda(f[c])).join(';'))].join('\r\n');
}

export function descargarCsv(filas: Record<string, unknown>[], nombre: string): void {
  const blob = new Blob(['﻿' + aCsv(filas)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}
