import { BadRequestException, Injectable } from '@nestjs/common';
import type { EmpresaActual, UsuarioActual } from '../../../common/index.js';
import type { CambiarEstadoDto, ConfigContableDto, GuardarAsientoDto } from '../dto/asiento.dto.js';
import { ActividadRespuesta, AsientoRespuesta, ConfigRespuesta } from '../dto/respuesta.dto.js';
import { ContabilidadRepository } from '../repositories/contabilidad.repository.js';

const PERIODO = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Reglas de la API de contabilidad. Las reglas contables (partida doble, correlativo,
 * aprobaciones, permisos) se aplican en la base de datos para que nadie pueda saltarlas.
 */
@Injectable()
export class ContabilidadService {
  constructor(private readonly repo: ContabilidadRepository) {}

  /**
   * Todo lo que muestra la pantalla en UNA sola petición (en vez de 5):
   * asientos del periodo, pendientes de aprobación, actividad, periodos y configuración.
   * Las consultas a la base de datos van en paralelo.
   */
  async panel(u: UsuarioActual, e: EmpresaActual, periodo: string) {
    if (!PERIODO.test(periodo)) throw new BadRequestException('Periodo inválido (AAAA-MM)');
    const [asientos, porAprobar, actividad, periodos, config] = await Promise.all([
      this.repo.asientosDelPeriodo(u.token, e.id, periodo),
      this.repo.porAprobar(u.token, e.id),
      this.repo.actividad(u.token, e.id, 40),
      this.repo.periodos(u.token, e.id),
      this.repo.config(u.token, e.id),
    ]);
    return {
      asientos: asientos.map((a) => AsientoRespuesta.desde(a)),
      porAprobar: porAprobar.map((a) => AsientoRespuesta.desde(a)),
      actividad: actividad.map((a) => ActividadRespuesta.desde(a)),
      periodos,
      // Dueño y admin aprueban: ya lo sabemos por el guard, sin otra consulta
      config: { ...ConfigRespuesta.desde(config), aprobador: e.rol === 'dueno' || e.rol === 'admin' },
    };
  }

  async asientos(u: UsuarioActual, e: EmpresaActual, periodo: string) {
    if (!PERIODO.test(periodo)) throw new BadRequestException('Periodo inválido (AAAA-MM)');
    const filas = await this.repo.asientosDelPeriodo(u.token, e.id, periodo);
    return filas.map((a) => AsientoRespuesta.desde(a));
  }

  async porAprobar(u: UsuarioActual, e: EmpresaActual) {
    return (await this.repo.porAprobar(u.token, e.id)).map((a) => AsientoRespuesta.desde(a));
  }

  periodos(u: UsuarioActual, e: EmpresaActual) {
    return this.repo.periodos(u.token, e.id);
  }

  async actividad(u: UsuarioActual, e: EmpresaActual) {
    return (await this.repo.actividad(u.token, e.id, 40)).map((a) => ActividadRespuesta.desde(a));
  }

  /** Configuración y si quien pregunta puede aprobar (dueño o admin). */
  async config(u: UsuarioActual, e: EmpresaActual) {
    const [config, aprobador] = await Promise.all([
      this.repo.config(u.token, e.id),
      this.repo.esAprobador(u.token, e.id),
    ]);
    return { ...ConfigRespuesta.desde(config), aprobador };
  }

  async guardarConfig(u: UsuarioActual, e: EmpresaActual, dto: ConfigContableDto) {
    await this.repo.guardarConfig(u.token, e.id, dto);
    return this.config(u, e);
  }

  async crear(u: UsuarioActual, e: EmpresaActual, dto: GuardarAsientoDto) {
    const id = await this.repo.guardarAsiento(u.token, e.id, null, dto.datos, dto.confirmar);
    return AsientoRespuesta.desde(await this.repo.asiento(u.token, e.id, id));
  }

  async actualizar(u: UsuarioActual, e: EmpresaActual, id: string, dto: GuardarAsientoDto) {
    await this.repo.guardarAsiento(u.token, e.id, id, dto.datos, dto.confirmar);
    return AsientoRespuesta.desde(await this.repo.asiento(u.token, e.id, id));
  }

  cambiarEstado(u: UsuarioActual, e: EmpresaActual, id: string, dto: CambiarEstadoDto) {
    return this.repo.cambiarEstado(u.token, e.id, id, dto.accion, dto.comentario);
  }
}
