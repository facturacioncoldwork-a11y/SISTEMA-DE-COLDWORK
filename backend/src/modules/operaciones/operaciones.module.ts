import { Module } from '@nestjs/common';
import { OperacionesController } from './controllers/operaciones.controller.js';
import { OperacionesRepository } from './repositories/operaciones.repository.js';
import { OperacionesService } from './services/operaciones.service.js';

@Module({
  controllers: [OperacionesController],
  providers: [OperacionesService, OperacionesRepository],
})
export class OperacionesModule {}
