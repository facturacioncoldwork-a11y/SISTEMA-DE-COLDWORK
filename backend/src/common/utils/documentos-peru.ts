/**
 * Documentos de identidad de Perú.
 *
 * RUC: 11 dígitos, empieza con 10 (persona natural), 15/16/17 (otros) o 20 (empresa),
 * y el último dígito es el verificador de SUNAT (módulo 11). Así un RUC mal tipeado no pasa.
 */

const PESOS_RUC = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

export function rucValido(ruc: string): boolean {
  if (!/^(10|15|16|17|20)\d{9}$/.test(ruc)) return false;
  const suma = PESOS_RUC.reduce((s, peso, i) => s + peso * Number(ruc[i]), 0);
  const resto = 11 - (suma % 11);
  const verificador = resto === 10 ? 0 : resto === 11 ? 1 : resto;
  return verificador === Number(ruc[10]);
}

export function dniValido(dni: string): boolean {
  return /^\d{8}$/.test(dni);
}

/** Problema del número según su tipo, o null si está bien. */
export function problemaDocumento(tipo: string, numero: string): string | null {
  if (tipo === 'RUC' && !rucValido(numero)) return 'El RUC no es válido (revisa los 11 dígitos).';
  if (tipo === 'DNI' && !dniValido(numero)) return 'El DNI debe tener 8 dígitos.';
  if (tipo === 'CE' && !/^[A-Z0-9]{8,12}$/i.test(numero)) return 'El carné de extranjería tiene 8 a 12 caracteres.';
  return null;
}
