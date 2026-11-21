import type { MiEmpresa } from '../models/empresa.model';

/**
 * SIMULACIÓN: empresas de María Quispe (ficticias) para mostrar cómo una misma
 * persona tiene un rol distinto en cada empresa. Se quita al conectar cuentas reales.
 */
export const EMPRESAS_MARIA: MiEmpresa[] = [
  { id: 'sim-coldwork', razonSocial: 'COLDWORK', ruc: null, rol: 'contador', areas: ['contabilidad'] },
  { id: 'sim-propia', razonSocial: 'Refrigeración Quispe E.I.R.L.', ruc: '20000000009', rol: 'dueno', areas: [] },
];
