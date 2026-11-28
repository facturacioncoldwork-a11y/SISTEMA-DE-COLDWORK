import { effect, inject, Injectable, signal } from '@angular/core';
import { ApiService } from '../../../core/api/services/api.service';
import { EmpresaActualService } from '../../../core/empresa/services/empresa-actual.service';

export interface CuentaBancaria {
  banco: string;
  moneda: 'PEN' | 'USD';
  numero: string;
  cci: string;
}

/** Sistema → Configuración. Mismos nombres que el backend (/empresas/actual/config). */
export interface ConfigEmpresa {
  telefono: string;
  correo: string;
  web: string;
  correoOrdenes: string;
  cuentas: CuentaBancaria[];
  /** Cuenta de detracciones (Banco de la Nación); vacía si no se usa. */
  cuentaDetraccion: { numero: string; cci: string };
  cotPrefijo: string;
  cotValidezProy: number;
  cotValidezServ: number;
  cotDetraccion: number;
  cotNotas: string;
}

export const CONFIG_POR_DEFECTO: ConfigEmpresa = {
  telefono: '',
  correo: '',
  web: '',
  correoOrdenes: '',
  cuentas: [],
  cuentaDetraccion: { numero: '', cci: '' },
  cotPrefijo: 'COT-',
  cotValidezProy: 15,
  cotValidezServ: 7,
  cotDetraccion: 12,
  cotNotas: 'No incluye obras civiles ni acometidas eléctricas.',
};

/**
 * Configuración de la empresa actual, cargada una vez por empresa y compartida por la pantalla
 * de Configuración, las cotizaciones (valores por defecto) y sus PDF (cuentas y correo).
 */
@Injectable({ providedIn: 'root' })
export class ConfigEmpresaService {
  private readonly api = inject(ApiService);
  private readonly empresa = inject(EmpresaActualService);
  private cargadaPara: string | null = null;

  readonly config = signal<ConfigEmpresa>(CONFIG_POR_DEFECTO);
  readonly cargada = signal(false);

  constructor() {
    effect(() => {
      const id = this.empresa.id();
      if (id && id !== this.cargadaPara) {
        this.cargadaPara = id;
        this.cargada.set(false);
        void this.recargar();
      }
    });
  }

  async recargar() {
    try {
      this.config.set({ ...CONFIG_POR_DEFECTO, ...(await this.api.get<ConfigEmpresa>('/empresas/actual/config')) });
    } catch {
      this.config.set(CONFIG_POR_DEFECTO);
    } finally {
      this.cargada.set(true);
    }
  }

  async guardar(c: ConfigEmpresa) {
    await this.api.put<void>('/empresas/actual/config', c);
    this.config.set(structuredClone(c));
  }
}
