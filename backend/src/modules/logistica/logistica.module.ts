import { Module } from '@nestjs/common';
import {
  AjustesController,
  AlmacenesController,
  MovimientosController,
  OrdenesCompraController,
  ProductosController,
  ProveedoresController,
} from './controllers/index.js';
import {
  AjustesRepository,
  AlmacenesRepository,
  MovimientosRepository,
  OrdenesCompraRepository,
  ProductosRepository,
  ProveedoresRepository,
} from './repositories/index.js';
import {
  AjustesService,
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
    AjustesController,
  ],
  providers: [
    ProductosService,
    AlmacenesService,
    ProveedoresService,
    OrdenesCompraService,
    MovimientosService,
    AjustesService,
    ProductosRepository,
    AlmacenesRepository,
    ProveedoresRepository,
    OrdenesCompraRepository,
    MovimientosRepository,
    AjustesRepository,
  ],
})
export class LogisticaModule {}
