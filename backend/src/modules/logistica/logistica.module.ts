import { Module } from '@nestjs/common';
import {
  AjustesController,
  PagosController,
  AlmacenesController,
  MovimientosController,
  OrdenesCompraController,
  ProductosController,
  ProveedoresController,
} from './controllers/index.js';
import {
  AjustesRepository,
  PagosRepository,
  AlmacenesRepository,
  MovimientosRepository,
  OrdenesCompraRepository,
  ProductosRepository,
  ProveedoresRepository,
} from './repositories/index.js';
import {
  AjustesService,
  PagosService,
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
    PagosController,
  ],
  providers: [
    ProductosService,
    AlmacenesService,
    ProveedoresService,
    OrdenesCompraService,
    MovimientosService,
    AjustesService,
    PagosService,
    ProductosRepository,
    AlmacenesRepository,
    ProveedoresRepository,
    OrdenesCompraRepository,
    MovimientosRepository,
    AjustesRepository,
    PagosRepository,
  ],
})
export class LogisticaModule {}
