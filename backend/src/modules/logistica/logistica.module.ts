import { Module } from '@nestjs/common';
import {
  AlmacenesController,
  MovimientosController,
  OrdenesCompraController,
  ProductosController,
  ProveedoresController,
} from './controllers/index.js';
import {
  AlmacenesRepository,
  MovimientosRepository,
  OrdenesCompraRepository,
  ProductosRepository,
  ProveedoresRepository,
} from './repositories/index.js';
import {
  AlmacenesService,
  MovimientosService,
  OrdenesCompraService,
  ProductosService,
  ProveedoresService,
} from './services/index.js';

/**
 * Módulo Almacén y logística (área `logistica`).
 * Capas: controllers (HTTP) → services (reglas) → repositories (Supabase) → BD.
 */
@Module({
  controllers: [
    ProductosController,
    AlmacenesController,
    ProveedoresController,
    OrdenesCompraController,
    MovimientosController,
  ],
  providers: [
    ProductosService,
    AlmacenesService,
    ProveedoresService,
    OrdenesCompraService,
    MovimientosService,
    ProductosRepository,
    AlmacenesRepository,
    ProveedoresRepository,
    OrdenesCompraRepository,
    MovimientosRepository,
  ],
})
export class LogisticaModule {}
