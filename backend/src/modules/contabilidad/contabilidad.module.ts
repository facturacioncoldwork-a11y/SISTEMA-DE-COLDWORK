import { Module } from '@nestjs/common';
import { ContabilidadController } from './controllers/contabilidad.controller.js';
import { ContabilidadRepository } from './repositories/contabilidad.repository.js';
import { ContabilidadService } from './services/contabilidad.service.js';

/**
 * Módulo Contabilidad (área `contabilidad`): asientos, aprobaciones, actividad y configuración.
 * Capas: controller (HTTP) → service → repository (Supabase) → funciones SQL con las reglas.
 */
@Module({
  controllers: [ContabilidadController],
  providers: [ContabilidadService, ContabilidadRepository],
})
export class ContabilidadModule {}
