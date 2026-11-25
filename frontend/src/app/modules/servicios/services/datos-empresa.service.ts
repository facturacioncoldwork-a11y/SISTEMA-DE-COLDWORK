import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { AuthService } from '../../../core/auth/services/auth.service';
import { EmpresaActualService } from '../../../core/empresa/services/empresa-actual.service';
import type { Area } from '../../../core/permisos/areas';
import type { Miembro } from '../../equipo/models/equipo.model';
import { EquipoService } from '../../equipo/services/equipo.service';
import type { Tercero } from '../../finanzas/models/finanzas.model';
import { FinanzasApi } from '../../finanzas/services/finanzas-api.service';

/**
 * Datos REALES de la empresa que usan las vistas previas de Operaciones:
 * clientes (Finanzas · Clientes y proveedores) y personal (Equipo y accesos).
 * Nada inventado: si la empresa aún no tiene clientes o personal, las listas salen vacías.
 */
@Injectable({ providedIn: 'root' })
export class DatosEmpresa {
  private readonly finanzas = inject(FinanzasApi);
  private readonly equipo = inject(EquipoService);
  private readonly empresa = inject(EmpresaActualService);
  private readonly auth = inject(AuthService);

  readonly terceros = signal<Tercero[]>([]);
  readonly miembros = signal<Miembro[]>([]);
  readonly cargando = signal(false);
  private cargadaPara: string | null = null;

  readonly clientes = computed(() => this.terceros().filter((t) => t.esCliente && t.activo));
  readonly activos = computed(() => this.miembros().filter((m) => m.activo));

  /** Quien está usando la app (para "Tú" y para el correo de la cotización). */
  readonly yo = computed(() => {
    const u = this.auth.usuario();
    const nombre = (u?.user_metadata?.['nombre'] as string | undefined) ?? (u?.user_metadata?.['full_name'] as string | undefined);
    return { id: u?.id ?? 'yo', nombre: nombre?.trim() || 'Tú', correo: u?.email ?? '' };
  });

  constructor() {
    // Al cambiar de empresa, los datos son otros
    effect(() => {
      const id = this.empresa.id();
      if (id && id !== this.cargadaPara) void this.cargar(id);
    });
  }

  conArea(area: Area): Miembro[] {
    return this.activos().filter((m) => m.rol === 'dueno' || m.rol === 'admin' || m.areas.includes(area));
  }

  private async cargar(empresaId: string) {
    this.cargadaPara = empresaId;
    this.cargando.set(true);
    // Cada parte puede no estar permitida para quien entra: se usa lo que se pueda
    const [t, e] = await Promise.allSettled([this.finanzas.terceros(), this.equipo.listar()]);
    this.terceros.set(t.status === 'fulfilled' ? t.value : []);
    this.miembros.set(e.status === 'fulfilled' ? e.value.miembros : []);
    this.cargando.set(false);
  }
}
