-- =====================================================================
-- COLDWORK · Datos iniciales de ALMACÉN Y LOGÍSTICA
-- ---------------------------------------------------------------------
-- Cómo usarlo:
--   1. Primero ejecuta las migraciones (ver docs/LOGISTICA.md, "Paso a paso").
--   2. Cambia abajo los datos de ejemplo por los tuyos (o borra los que no uses).
--   3. Supabase → SQL Editor → pega TODO este archivo → Run.
-- Se puede ejecutar varias veces: lo que ya existe no se duplica.
--
-- La empresa se busca por su RUC: no hace falta copiar ningún id.
-- El STOCK INICIAL NO va aquí: se carga desde la app (Llegadas → "Compra
-- directa u otro ingreso") para que quede en el kardex con su costo.
-- =====================================================================

-- RUC de tu empresa tal como está en la tabla empresas
-- (verifícalo con:  select id, ruc, razon_social from empresas;)
-- Si tu empresa no tiene RUC cargado y es la única, se usa igual.
drop table if exists _empresa;
create temporary table _empresa as
  select id from public.empresas where ruc = '20608689941';

-- Si no hay ninguna con ese RUC pero en la base hay UNA sola empresa, se usa esa
insert into _empresa
  select id from public.empresas
  where not exists (select 1 from _empresa) and (select count(*) from public.empresas) = 1;

do $$
begin
  if (select count(*) from _empresa) <> 1 then
    raise exception 'No pude elegir la empresa. Mira: select id, ruc, razon_social from empresas;  y pon su RUC en la línea 20 de este archivo (o cárgalo con: update empresas set ruc = ''20608689941'' where id = ''...'';)';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. ALMACENES  (tipo: principal | movil | obra)
--    codigo: 2 a 12 letras/números/guion, en MAYÚSCULAS
-- ---------------------------------------------------------------------
insert into public.almacenes (empresa_id, codigo, nombre, tipo, direccion, responsable)
select e.id, a.codigo, a.nombre, a.tipo::public.tipo_almacen, a.direccion, a.responsable
from _empresa e, (values
  ('ALM-01', 'Almacén principal Ica',      'principal', 'Urb. San Ildefonso III Et. Mz. E1 Lt 14, La Tinguiña - Ica', 'José Sánchez Solano'),
  ('MOV-01', 'Unidad móvil · Técnico 1',   'movil',     null,                                                          'Nombre del técnico')
  -- , ('OBR-01', 'Obra / cliente', 'obra', 'Dirección de la obra', 'Responsable')
) as a(codigo, nombre, tipo, direccion, responsable)
on conflict (empresa_id, codigo) do nothing;

-- ---------------------------------------------------------------------
-- 2. PROVEEDORES  (tabla terceros; tipo_documento: RUC | DNI | CE | OTRO)
--    dias_credito: 0 = contado · calificacion: 1 a 5 o null
-- ---------------------------------------------------------------------
insert into public.terceros (empresa_id, tipo_documento, numero_documento, razon_social, es_proveedor, rubro, contacto, telefono, correo, direccion, dias_credito, calificacion)
select e.id, p.tdoc, p.ndoc, p.razon, true, p.rubro, p.contacto, p.telefono, p.correo, p.direccion, p.credito, p.calif
from _empresa e, (values
  ('RUC', '20505717672', 'FRIO IMPORTACIONES S.A.C', 'Refrigeración y aire acondicionado', null, '943012369', 'ventas4@frioimportaciones.com.pe', 'Alemania Nro 2196 - Cercado de Lima', 0, 4),
  ('RUC', '20534470402', 'FRIOTEAM SAC',            'Repuestos de refrigeración',          null, null,         null,                               'Panamericana Sur Km 298, Subtanjalla - Ica', 15, null)
  -- , ('RUC', '20xxxxxxxxx', 'OTRO PROVEEDOR S.A.C.', 'Rubro', 'Contacto', 'Teléfono', 'correo@proveedor.pe', 'Dirección', 30, 5)
) as p(tdoc, ndoc, razon, rubro, contacto, telefono, correo, direccion, credito, calif)
on conflict (empresa_id, numero_documento) do nothing;

-- ---------------------------------------------------------------------
-- 3. PRODUCTOS
--    sku: 2 a 30 letras/números/punto/guion/guion bajo, en MAYÚSCULAS
--    tipo: repuesto | gas_refrigerante | herramienta | insumo | equipo
--    unidad: UND, KG, LB, BAL, M, PIE, LT, GAL, JGO, KIT, ROLLO, CAJA
--    stock_minimo: desde cuánto avisa "Reponer"
--    (el costo promedio se calcula solo al registrar llegadas)
-- ---------------------------------------------------------------------
insert into public.productos (empresa_id, sku, nombre, tipo, marca, unidad, stock_minimo)
select e.id, x.sku, x.nombre, x.tipo::public.tipo_producto, x.marca, x.unidad, x.minimo
from _empresa e, (values
  ('023U1921',  '48 - F NUC IMP con empaque y paquete ind', 'repuesto',          'DANFOSS',   'UND', 4),
  ('023U4381',  '48 - DC Núcleo (con empaque)',             'repuesto',          'DANFOSS',   'UND', 4),
  ('AL3G4',     'Aceite mineral 3GS - 4 litros',            'insumo',            'ST-ALBANS', 'UND', 2),
  ('AL324',     'Aceite polyolester POE32 - 4 litros',      'insumo',            'ST-ALBANS', 'UND', 2),
  ('030-713',   'Filtro secador C 165 R 5/8" roscable',     'repuesto',          'RAC',       'UND', 3),
  ('RFS0025',   'Conector recto de 1/4" para presostatos',  'repuesto',          null,        'UND', 5),
  ('RFS116',    'Conector curvo de 1/4" para presostatos',  'repuesto',          null,        'UND', 5),
  ('GAS-R404A', 'Gas refrigerante R-404A 10.9 kg',          'gas_refrigerante',  'GENETRON',  'BAL', 2)
) as x(sku, nombre, tipo, marca, unidad, minimo)
on conflict (empresa_id, sku) do nothing;

-- ---------------------------------------------------------------------
-- Verificación: cuántos registros quedaron
-- ---------------------------------------------------------------------
select 'almacenes' as tabla, count(*) from public.almacenes where empresa_id in (select id from _empresa)
union all select 'proveedores', count(*) from public.terceros where es_proveedor and empresa_id in (select id from _empresa)
union all select 'productos', count(*) from public.productos where empresa_id in (select id from _empresa);
