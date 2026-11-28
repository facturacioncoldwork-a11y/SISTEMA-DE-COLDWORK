import { BadRequestException, Injectable } from '@nestjs/common';
import { datosOError, type Area, type Rol, type UsuarioActual } from '../../../common/index.js';
import { SupabaseService } from '../../../database/supabase/supabase.service.js';
import {
  ActualizarEmpresaDto,
  ConfigEmpresaDto,
  CrearEmpresaDto,
  EmpresaCreadaDto,
  EmpresaRespuestaDto,
  MiEmpresaDto,
} from '../dto/index.js';
import { COLUMNAS_EMPRESA, type EmpresaEntity } from '../entities/empresa.entity.js';

/** Fila que devuelve la función SQL `mis_empresas()`. */
interface FilaMiEmpresa {
  id: string;
  razon_social: string;
  ruc: string | null;
  rol: Rol;
  areas: Area[];
}

/**
 * Lógica de negocio de empresas.
 * La BD usa snake_case (entities) y la API expone camelCase (DTOs).
 * Toda consulta va con el token del usuario → RLS siempre aplica.
 */
@Injectable()
export class EmpresasService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Empresas del usuario. Antes acepta las invitaciones pendientes a su correo,
   * así un trabajador invitado entra solo la primera vez que inicia sesión.
   */
  async mias(u: UsuarioActual): Promise<MiEmpresaDto[]> {
    const cliente = this.supabase.paraUsuario(u.token);
    datosOError(await cliente.rpc('aceptar_invitaciones'));
    const filas = datosOError(await cliente.rpc('mis_empresas')) as FilaMiEmpresa[] | null;
    return (filas ?? []).map((f) => ({
      id: f.id,
      razonSocial: f.razon_social,
      ruc: f.ruc,
      rol: f.rol,
      areas: f.areas ?? [],
    }));
  }

  async crear(u: UsuarioActual, dto: CrearEmpresaDto): Promise<EmpresaCreadaDto> {
    const id = datosOError(
      await this.supabase
        .paraUsuario(u.token)
        .rpc('crear_empresa', { p_razon_social: dto.razonSocial, p_ruc: dto.ruc ?? null }),
    ) as string;
    return { id };
  }

  async obtener(u: UsuarioActual, empresaId: string): Promise<EmpresaRespuestaDto> {
    const fila = datosOError(
      await this.supabase
        .paraUsuario(u.token)
        .from('empresas')
        .select(COLUMNAS_EMPRESA)
        .eq('id', empresaId)
        .single<EmpresaEntity>(),
    );
    return EmpresaRespuestaDto.desde(fila);
  }

  async actualizar(u: UsuarioActual, empresaId: string, dto: ActualizarEmpresaDto): Promise<EmpresaRespuestaDto> {
    const cambios: Partial<EmpresaEntity> = {};
    if (dto.razonSocial !== undefined) cambios.razon_social = dto.razonSocial.trim();
    if (dto.ruc !== undefined) cambios.ruc = dto.ruc;
    if (dto.nombreComercial !== undefined) cambios.nombre_comercial = dto.nombreComercial.trim() || null;
    if (dto.direccion !== undefined) cambios.direccion = dto.direccion.trim() || null;
    if (Object.keys(cambios).length === 0) throw new BadRequestException('No hay cambios');

    const fila = datosOError(
      await this.supabase
        .paraUsuario(u.token)
        .from('empresas')
        .update(cambios)
        .eq('id', empresaId)
        .select(COLUMNAS_EMPRESA)
        .single<EmpresaEntity>(),
    );
    return EmpresaRespuestaDto.desde(fila);
  }

  /** Configuración de la empresa (contacto, cuentas, valores de cotización). Si no la guardó, valores por defecto. */
  async config(u: UsuarioActual, empresaId: string): Promise<ConfigEmpresaDto> {
    const f = datosOError(
      await this.supabase.paraUsuario(u.token).from('empresa_config').select('*').eq('empresa_id', empresaId).maybeSingle(),
    ) as Record<string, unknown> | null;
    return aConfig(f);
  }

  async guardarConfig(u: UsuarioActual, empresaId: string, dto: ConfigEmpresaDto): Promise<void> {
    datosOError(await this.supabase.paraUsuario(u.token).rpc('empresa_guardar_config', { p_empresa: empresaId, p_datos: dto }));
  }
}

const texto = (v: unknown, defecto = '') => (typeof v === 'string' ? v : defecto);

export function aConfig(f: Record<string, unknown> | null): ConfigEmpresaDto {
  return {
    telefono: texto(f?.['telefono']),
    correo: texto(f?.['correo']),
    web: texto(f?.['web']),
    correoOrdenes: texto(f?.['correo_ordenes']),
    cuentas: Array.isArray(f?.['cuentas']) ? (f['cuentas'] as ConfigEmpresaDto['cuentas']) : [],
    cuentaDetraccion: {
      numero: texto((f?.['cuenta_detraccion'] as Record<string, unknown> | undefined)?.['numero']),
      cci: texto((f?.['cuenta_detraccion'] as Record<string, unknown> | undefined)?.['cci']),
    },
    cotPrefijo: texto(f?.['cot_prefijo'], 'COT-'),
    cotValidezProy: Number(f?.['cot_validez_proy'] ?? 15),
    cotValidezServ: Number(f?.['cot_validez_serv'] ?? 7),
    cotDetraccion: Number(f?.['cot_detraccion'] ?? 12),
    cotNotas: texto(f?.['cot_notas'], 'No incluye obras civiles ni acometidas eléctricas.'),
  };
}
