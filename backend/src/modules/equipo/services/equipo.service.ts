import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { datosOError, Rol, type EmpresaActual, type UsuarioActual } from '../../../common/index.js';
import { SupabaseService } from '../../../database/supabase/supabase.service.js';
import { ActualizarMiembroDto, EquipoDto, InvitacionDto, InvitarDto, MiembroDto } from '../dto/index.js';
import { COLUMNAS_INVITACION, type FilaEquipo, type InvitacionEntity } from '../entities/invitacion.entity.js';
import type { MiembroEntity } from '../entities/miembro.entity.js';
import { MEMBRESIAS } from '../../auth/guards/empresa.guard.js';

/**
 * Equipo de la empresa: quién entra y a qué áreas.
 * Reglas (RLS las vuelve a exigir en la BD):
 *  · SOLO EL DUEÑO (CEO) gestiona el equipo: invita, da o quita áreas, bloquea.
 *    Un admin o un trabajador no puede darse ni dar acceso a otras áreas.
 *  · Nadie se edita ni se quita a sí mismo (así la empresa nunca se queda sin dueño).
 *  · Al dueño no lo toca nadie.
 */
@Injectable()
export class EquipoService {
  constructor(private readonly supabase: SupabaseService) {}

  async listar(u: UsuarioActual, e: EmpresaActual): Promise<EquipoDto> {
    const cliente = this.supabase.paraUsuario(u.token);
    const [miembros, invitaciones] = await Promise.all([
      cliente.rpc('equipo_empresa', { p_empresa: e.id }),
      cliente
        .from('invitaciones')
        .select(COLUMNAS_INVITACION)
        .eq('empresa_id', e.id)
        .order('creado_en', { ascending: false }),
    ]);
    return {
      miembros: ((datosOError(miembros) as FilaEquipo[] | null) ?? []).map((f) => MiembroDto.desde(f)),
      invitaciones: ((datosOError(invitaciones) as InvitacionEntity[] | null) ?? []).map((i) => InvitacionDto.desde(i)),
    };
  }

  /** Invita (o actualiza la invitación de) un correo. */
  async invitar(u: UsuarioActual, e: EmpresaActual, dto: InvitarDto): Promise<InvitacionDto> {
    this.soloDuenoDaAdmin(e, dto.rol);
    const cliente = this.supabase.paraUsuario(u.token);

    const equipo = (datosOError(await cliente.rpc('equipo_empresa', { p_empresa: e.id })) as FilaEquipo[] | null) ?? [];
    if (equipo.some((m) => m.correo.toLowerCase() === dto.correo)) {
      throw new ConflictException('Esa persona ya es parte del equipo; edita sus áreas en la lista');
    }

    const fila = datosOError(
      await cliente
        .from('invitaciones')
        .upsert(
          {
            empresa_id: e.id,
            correo: dto.correo,
            nombre: dto.nombre?.trim() || null,
            rol: dto.rol,
            areas: dto.rol === Rol.Admin ? [] : dto.areas,
          },
          { onConflict: 'empresa_id,correo' },
        )
        .select(COLUMNAS_INVITACION)
        .single<InvitacionEntity>(),
    );
    return InvitacionDto.desde(fila);
  }

  async cancelarInvitacion(u: UsuarioActual, e: EmpresaActual, id: string): Promise<void> {
    datosOError(
      await this.supabase.paraUsuario(u.token).from('invitaciones').delete().eq('id', id).eq('empresa_id', e.id),
    );
  }

  async actualizarMiembro(
    u: UsuarioActual,
    e: EmpresaActual,
    usuarioId: string,
    dto: ActualizarMiembroDto,
  ): Promise<void> {
    if (usuarioId === u.id) throw new BadRequestException('No puedes cambiar tu propio acceso');
    if (dto.rol) this.soloDuenoDaAdmin(e, dto.rol);

    const cambios: Partial<MiembroEntity> = {};
    if (dto.rol !== undefined) cambios.rol = dto.rol;
    if (dto.areas !== undefined) cambios.areas = dto.areas;
    if (dto.activo !== undefined) cambios.activo = dto.activo;
    if (Object.keys(cambios).length === 0) throw new BadRequestException('No hay cambios');

    const filas = datosOError(
      await this.supabase
        .paraUsuario(u.token)
        .from('miembros')
        .update(cambios)
        .eq('empresa_id', e.id)
        .eq('usuario_id', usuarioId)
        .neq('rol', Rol.Dueno)
        .select('usuario_id'),
    ) as { usuario_id: string }[] | null;
    if (!filas?.length) throw new ForbiddenException('No puedes modificar a esa persona');
    MEMBRESIAS.olvidar(`${usuarioId}:`); // el cambio de acceso rige al instante
  }

  async quitarMiembro(u: UsuarioActual, e: EmpresaActual, usuarioId: string): Promise<void> {
    if (usuarioId === u.id) throw new BadRequestException('No puedes quitarte a ti mismo');
    const filas = datosOError(
      await this.supabase
        .paraUsuario(u.token)
        .from('miembros')
        .delete()
        .eq('empresa_id', e.id)
        .eq('usuario_id', usuarioId)
        .neq('rol', Rol.Dueno)
        .select('usuario_id'),
    ) as { usuario_id: string }[] | null;
    if (!filas?.length) throw new ForbiddenException('No puedes quitar a esa persona');
    MEMBRESIAS.olvidar(`${usuarioId}:`);
  }

  private soloDuenoDaAdmin(e: EmpresaActual, rol: Rol) {
    if (rol === Rol.Admin && e.rol !== Rol.Dueno) {
      throw new ForbiddenException('Solo el dueño puede nombrar administradores');
    }
  }
}
