import { Module } from '@nestjs/common';
import { AsistenciaController } from './controllers/asistencia.controller.js';
import { AsistenciaRepository } from './repositories/asistencia.repository.js';
import { AsistenciaService } from './services/asistencia.service.js';

/** Módulo Asistencia: marcas, horario y ausencias (ver migración 20261127000001_asistencia.sql). */
@Module({
  controllers: [AsistenciaController],
  providers: [AsistenciaService, AsistenciaRepository],
})
export class AsistenciaModule {}
