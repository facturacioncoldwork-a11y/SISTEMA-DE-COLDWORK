import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { AuthService } from '../../../core/auth/services/auth.service';
import { EmpresaActualService } from '../../../core/empresa/services/empresa-actual.service';
import type { Area } from '../../../core/permisos/areas';
import type { Tercero } from '../../finanzas/models/finanzas.model';
import { FinanzasApi } from '../../finanzas/services/finanzas-api.service';
import { OperacionesApi, type PersonaDirectorio } from './operaciones-api.service';

/**
 * Datos REALES de la empresa que comparten los módulos: clientes (Finanzas · Clientes y
 * proveedores) y personal (directorio: nombre y áreas, sin correos; lo ve todo miembro).
 * Se carga una vez por empresa y lo reutilizan Asistencia, Servicios y Cotizaciones.
 */
@Injectable({ providedIn: 'root' })
export class DatosEmpresa {
  private readonly finanzas = inject(FinanzasApi);
  private readonly ope = inject(OperacionesApi);
  private readonly empresa = inject(EmpresaActualService);
  private readonly auth = inject(AuthService);

  readonly terceros = signal<Tercero[]>([]);
  readonly miembros = signal<PersonaDirectorio[]>([]);
  readonly cargando = signal(false);
  private cargadaPara: string | null = null;

  readonly clientes = computed(() => this.terceros().filter((t) => t.esCliente && t.activo));
  readonly activos = computed(() => this.miembros().filter((m) => m.activo));

  /** Quien está usando la app. El nombre sale del directorio (perfil) y, si no, de su cuenta. */
  readonly yo = computed(() => {
    const u = this.auth.usuario();
    const id = u?.id ?? '';
    const delPerfil = this.miembros().find((m) => m.usuarioId === id)?.nombre;
    const meta = (u?.user_metadata?.['nombre'] as string | undefined) ?? (u?.user_metadata?.['full_name'] as string | undefined);
    return { id, nombre: delPerfil?.trim() || meta?.trim() || 'Tú', correo: u?.email ?? '' };
  });

  constructor() {
    // Al cambiar de empresa, los datos son otros
    effect(() => {
      const id = this.empresa.id();
      if (id && id !== this.cargadaPara) void this.cargar(id);
    });
  }

  persona(id: string) {
    return this.miembros().find((m) => m.usuarioId === id);
  }

  conArea(area: Area): PersonaDirectorio[] {
    return this.activos().filter((m) => m.rol === 'dueno' || m.rol === 'admin' || m.areas.includes(area));
  }

  async recargarClientes() {
    this.terceros.set(await this.finanzas.terceros().catch(() => this.terceros()));
  }

  private async cargar(empresaId: string) {
    this.cargadaPara = empresaId;
    this.cargando.set(true);
    // Cada parte puede no estar permitida para quien entra: se usa lo que se pueda
    const [t, d] = await Promise.allSettled([this.finanzas.terceros(), this.ope.directorio()]);
    this.terceros.set(t.status === 'fulfilled' ? t.value : []);
    this.miembros.set(d.status === 'fulfilled' ? d.value : []);
    this.cargando.set(false);
  }
}
