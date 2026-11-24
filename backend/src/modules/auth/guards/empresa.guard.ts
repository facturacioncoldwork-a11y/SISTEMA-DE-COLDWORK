import { BadRequestException, CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  aHttp,
  AREA_REQUERIDA,
  Rol,
  ROLES_PERMITIDOS,
  type Area,
  type PeticionAutenticada,
} from '../../../common/index.js';
import { CacheTtl } from '../../../common/utils/cache-ttl.js';
import { SupabaseService } from '../../../database/supabase/supabase.service.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Guard GLOBAL que se activa solo en rutas con @RequiereEmpresa(...roles) o @RequiereArea(area).
 * Lee X-Empresa-Id, confirma que el usuario es miembro activo y, si la ruta
 * pide roles o un área, que los tenga. (RLS vuelve a comprobarlo en la BD.)
 */
@Injectable()
export class EmpresaGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly supabase: SupabaseService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const objetivos = [ctx.getHandler(), ctx.getClass()];
    const roles = this.reflector.getAllAndOverride<Rol[] | undefined>(ROLES_PERMITIDOS, objetivos);
    if (roles === undefined) return true; // la ruta no trabaja con empresa
    const area = this.reflector.getAllAndOverride<Area | undefined>(AREA_REQUERIDA, objetivos);

    const req = ctx.switchToHttp().getRequest<PeticionAutenticada>();
    if (!req.usuario) return false;

    const empresaId = req.header('x-empresa-id');
    if (!empresaId || !UUID.test(empresaId)) {
      throw new BadRequestException('Cabecera X-Empresa-Id ausente o inválida');
    }

    const data = await this.membresia(req.usuario.id, req.usuario.token, empresaId);
    if (!data) throw new ForbiddenException('No perteneces a esta empresa');
    if (roles.length > 0 && !roles.includes(data.rol)) {
      throw new ForbiddenException('Tu rol no permite esta acción');
    }
    const veTodo = data.rol === Rol.Dueno || data.rol === Rol.Admin;
    if (area && !veTodo && !data.areas.includes(area)) {
      throw new ForbiddenException('No tienes acceso a esta área');
    }

    req.empresa = { id: empresaId, rol: data.rol, areas: data.areas };
    return true;
  }

  /**
   * Rol y áreas del usuario en la empresa. Se recuerda 30 s para no consultar la base de datos
   * en cada petición (la pantalla hace varias seguidas). Si el dueño quita un acceso, rige en ≤ 30 s;
   * aun así los datos no se filtran: RLS lo vuelve a comprobar dentro de la base de datos.
   */
  private async membresia(usuarioId: string, token: string, empresaId: string): Promise<Membresia | null> {
    const clave = `${usuarioId}:${empresaId}`;
    const guardada = MEMBRESIAS.obtener(clave);
    if (guardada !== undefined) return guardada;

    const { data, error } = await this.supabase
      .paraUsuario(token)
      .from('miembros')
      .select('rol, areas')
      .eq('empresa_id', empresaId)
      .eq('usuario_id', usuarioId)
      .eq('activo', true)
      .maybeSingle<Membresia>();
    if (error) throw aHttp(error);

    MEMBRESIAS.guardar(clave, data ?? null);
    return data ?? null;
  }
}

interface Membresia {
  rol: Rol;
  areas: Area[];
}

/** Memoria corta de membresías (por instancia del servidor). */
export const MEMBRESIAS = new CacheTtl<Membresia | null>(30_000);
