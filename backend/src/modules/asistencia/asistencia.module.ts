import { Module } from '@nestjs/common';
import { AsistenciaController, TabletaController } from './controllers/asistencia.controller.js';
import { AsistenciaRepository } from './repositories/asistencia.repository.js';
import { AsistenciaService } from './services/asistencia.service.js';

/** Módulo Asistencia: marcas, horario y ausencias (ver migración 20261127000001_asistencia.sql). */
@Module({
  controllers: [AsistenciaController, TabletaController],
  providers: [AsistenciaService, AsistenciaRepository],
})
export class AsistenciaModule {}
