import { Module } from '@nestjs/common';
import { FinanzasController } from './controllers/finanzas.controller.js';
import { FinanzasRepository } from './repositories/finanzas.repository.js';
import { FinanzasService } from './services/finanzas.service.js';

/**
 * Módulo Finanzas: clientes y proveedores, ventas, compras, caja y bancos,
 * cuentas por cobrar y pagar, y saldos para los reportes.
 * Cada documento genera su asiento contable automático (ver migración 20261125000001_finanzas.sql).
 */
@Module({
  controllers: [FinanzasController],
  providers: [FinanzasService, FinanzasRepository],
})
export class FinanzasModule {}
