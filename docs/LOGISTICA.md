# Módulo Almacén y logística

## Paso a paso para conectarlo a la base de datos

Todo se hace en **Supabase → SQL Editor** (pega el archivo completo → **Run**).

1. **¿Qué ya tienes?** Ejecuta `supabase/estado-migraciones.sql`. Muestra una columna por migración con `true` (ya está) o `false` (falta).
2. **Crea lo que falta**: ejecuta, **en orden** y una sola vez, cada archivo de `supabase/migrations/` que salió `false`:

   | Archivo | Qué crea |
   |---|---|
   | `20261118000001_base_empresas.sql` | empresas, perfiles, miembros (seguro ya lo tienes) |
   | `20261119000001_equipo_areas.sql` | áreas e invitaciones (seguro ya lo tienes) |
   | `20261120000001_logistica.sql` | **terceros, almacenes, productos, stock, ordenes_compra, ordenes_compra_items, llegadas, salidas, movimientos** + funciones de stock |
   | `20261121000001_logistica_plazos_crud.sql` | plazos de entrega, seguimiento al cliente, editar y eliminar |
   | `20261122000001_accesos_solo_dueno.sql` | solo el dueño da accesos |
   | `20261123000001_oc_formato_y_moneda.sql` | formato de la orden de compra, moneda y tipo de cambio |
   | `20261126000001_logistica_antiguedad.sql` | antigüedad del inventario (vender lo que lleva años) |

3. **Vuelve a ejecutar** `estado-migraciones.sql`: todo debe salir `true`.
4. **Carga tus datos**: abre `supabase/datos-iniciales.sql`, cambia los ejemplos por tus almacenes, proveedores y productos (el RUC de la empresa arriba) y ejecútalo. Se puede correr varias veces sin duplicar.
5. **Da acceso**: el dueño entra a la app → **Equipo y accesos** → invita al encargado con rol *Trabajador* y área **Logística**.
6. **Stock inicial**: desde la app, **Llegadas → Registrar llegada → "Compra directa u otro ingreso"** (así queda en el kardex con su costo).
7. **Publicar la app**: el código nuevo debe subirse al repositorio y desplegarse (Render/Cloudflare se actualizan con cada push a `main`). Hasta entonces, la app en la nube no tiene estas pantallas.

## Cómo crear las tablas en Supabase

Son **cinco archivos** y se ejecutan **en este orden** (una sola vez cada uno):

1. `supabase/migrations/20261120000001_logistica.sql` → tablas, RLS y funciones de stock.
2. `supabase/migrations/20261121000001_logistica_plazos_crud.sql` → plazos de entrega, seguimiento al cliente y eliminar/editar.
3. `supabase/migrations/20261122000001_accesos_solo_dueno.sql` → solo el dueño (CEO) da accesos.
4. `supabase/migrations/20261123000001_oc_formato_y_moneda.sql` → orden de compra en formato COLD WORK, moneda (S/ o US$) y tipo de cambio en las llegadas.
5. `supabase/migrations/20261126000001_logistica_antiguedad.sql` → antigüedad del inventario: lotes por fecha de ingreso, límite para "vender pronto" y fecha de llegada corregible.

Supabase → **SQL Editor** → pega el archivo completo → **Run**.
(No lo crees a mano tabla por tabla: también crea las reglas RLS y las funciones que mueven el stock.)

Requiere que ya estén las migraciones 0001 (empresas) y 0002 (equipo y áreas).

## Quién ve qué

| Persona | Rol / áreas | Ve | Da accesos |
|---|---|---|---|
| Dueño (CEO) | `dueno` | Todo | **Sí, solo él** |
| Administrador | `admin` | Todo (incluida la parte contable) | No |
| Encargado de logística | `trabajador` + área `logistica` | Inicio y Almacén y logística. **Nada contable** (ni caja, ni compras con comprobantes, ni contabilidad) | No |

Para dar acceso al encargado de logística: el dueño entra a **Equipo y accesos → Invitar persona**, rol *Trabajador*, marca solo **Logística**.

## Tablas

| Tabla | Para qué | Columnas principales |
|---|---|---|
| `terceros` | Proveedores (y luego clientes) | tipo_documento, numero_documento, razon_social, es_proveedor, es_cliente, rubro, contacto, telefono, correo, direccion, dias_credito, calificacion (1-5), activo |
| `almacenes` | Dónde se guarda el stock | codigo (ALM-01), nombre, tipo (`principal` / `movil` / `obra`), direccion, responsable, activo |
| `productos` | Catálogo | sku, nombre, descripcion, tipo (`repuesto` / `gas_refrigerante` / `herramienta` / `insumo` / `equipo`), marca, unidad, stock_minimo, costo_promedio, activo |
| `stock` | Cantidad por producto y almacén | producto_id, almacen_id, cantidad (nunca negativa) |
| `ordenes_compra` | Pedido al proveedor | numero, proveedor_id, almacen_id, estado (`borrador` → `enviada` → `parcial` → `recibida` / `anulada`), fecha, notas, **plazo_texto** ("2-3 semanas"), **entrega_desde / entrega_hasta** (ventana calculada), **fecha_llegada_real**, **cliente**, **compromiso_cliente**, **entregado_cliente** |
| `ordenes_compra_items` | Productos del pedido | orden_id, producto_id, cantidad, cantidad_recibida, costo_unitario |
| `llegadas` | Entrada de producto | numero, almacen_id, proveedor_id, orden_id, guia_remision, comprobante, notas |
| `salidas` | Salida o despacho | numero, almacen_id, motivo (`servicio_tecnico` / `venta` / `consumo_interno` / `merma` / `transferencia`), almacen_destino_id, destino, responsable, referencia |
| `movimientos` | Kardex: cada entrada y salida | producto_id, almacen_id, tipo, cantidad, costo_unitario, saldo, llegada_id / salida_id |

Todas llevan `empresa_id` y RLS: solo las ve quien tiene el área **Logística** (el dueño y el admin siempre).

## Funciones (las llama el backend)

| Función | Qué hace en una sola transacción |
|---|---|
| `registrar_llegada` | Suma stock, recalcula el costo promedio ponderado, escribe el kardex y actualiza el avance de la OC |
| `registrar_salida` | Valida que alcance el stock, lo resta, escribe el kardex; en transferencia lo suma al destino |
| `crear_orden_compra` / `cambiar_estado_oc` | Crea la OC con su número correlativo, la envía o la anula |
| `resumen_logistica` | Indicadores del panel |

## Plazos de entrega y seguimiento al cliente

- El proveedor dice "2-3 semanas", "1 mes" o una fecha exacta: se guarda el texto y la app calcula la **ventana** de llegada desde la fecha de la orden.
- Al recibir todo, la BD llena `fecha_llegada_real` con la fecha que se puso en la llegada (por defecto hoy).
- Con `cliente` y `compromiso_cliente`, la app avisa si la llegada estimada pasa la fecha prometida, y se marca `entregado_cliente` cuando se entrega.

## Antigüedad del inventario (vender lo que lleva años)

El almacén guarda sobrantes de proyectos: no siempre se repone, pero hay que saber **qué hay y desde cuándo**, para no comprar de más y para vender pronto (aunque sea con descuento) lo que lleva años guardado.

- **Cómo se calcula:** la vista `stock_lotes` reparte el stock actual entre las llegadas que lo trajeron, asumiendo que sale primero lo más antiguo (PEPS). Si un producto se compra y se usa seguido, no aparece como antiguo; solo lo que de verdad no se movió. Las transferencias entre almacenes no cambian la antigüedad.
- **Límite:** por defecto **24 meses** (tabla `logistica_ajustes`). Solo el dueño o un admin lo cambian, desde *Panel de almacén → Vender pronto → Cambiar*. Avisa en ámbar unos meses antes (con 24, desde los 18).
- **Dónde se ve:** el indicador y la tarjeta *Vender pronto* del panel, el filtro *Antiguos* y la columna *En almacén* del inventario, y el aviso rojo en el panel lateral de cada producto.
- **Stock que ya estaba guardado:** al cargarlo con *Registrar llegada → Compra directa u otro ingreso*, pon la **fecha aproximada en que llegó**. Si te equivocas, en el panel lateral del producto (*¿Desde cuándo está en almacén?*) puedes corregirla. Eso cambia la fecha de toda la llegada, el kardex y la orden de compra se actualizan solos y no se acepta una fecha futura.
- **Para no pedir de más:** al armar una orden de compra o importar una cotización, cada producto muestra *Ya tienes X en almacén* (en rojo si lo que hay es antiguo).
- **Stock mínimo:** es opcional. Con 0 no hay aviso de reposición, y quedarse sin stock se muestra en gris (*Sin stock*) en vez de rojo (*Agotado*).

## Pagos a proveedores (solo el CEO)

Pestaña **Pagos** de Logística: lo comprado por proyecto, cuándo llega y **cuánto se debe** a cada proveedor, para no olvidar ningún vencimiento. Incluye los adelantos que se pagan antes de recibir la factura (Finanzas → Cuentas por pagar empieza con la factura).

- **Proyecto en cada OC:** al crear o editar la orden se elige el proyecto de Operaciones (cotizaciones aprobadas o enviadas). El código y el nombre se copian solos (`proyecto_codigo`, `proyecto_nombre`); también se guarda la **fecha de aprobación**.
- **Plan de pagos** (tabla `oc_pagos`): cada OC tiene sus cuotas con monto, vencimiento y si ya se pagó (fecha y n° de operación). Hay plantillas: contado, adelanto y saldo (ej. 50 % / 50 %), crédito a N días de la llegada (por defecto los días de crédito del proveedor) y adelanto + crédito. También se puede armar a mano.
- **Recordatorio:** número rojo en la pestaña con lo vencido o que vence hoy, y aviso arriba con lo vencido, lo que vence en 7 días y las órdenes que aún no tienen plan.
- **Quién lo ve:** solo el dueño (RLS). El encargado de logística elige el proyecto en la OC, pero no ve montos adeudados ni pagos.
- Una OC con pagos ya hechos **no se puede eliminar** (se anula).
- Migración: `20261129000001_oc_pagos.sql` (necesita antes la de Operaciones `20261128000001_operaciones.sql`).

## Eliminar (CRUD)

| Qué | Qué pasa en la BD |
|---|---|
| Producto, proveedor, almacén | Se borra de verdad. Si tiene historial (movimientos, órdenes, stock), la BD lo impide y la app sugiere **desactivarlo**. |
| Orden de compra | Se borra con sus productos. Si ya tiene llegadas, primero se eliminan esas llegadas. |
| Llegada | `eliminar_llegada`: resta el stock que entró, borra su kardex y la OC vuelve a quedar pendiente. Si ese stock ya salió, no deja. |
| Salida | `eliminar_salida`: devuelve el stock (en transferencias, lo quita del destino). |

Las cantidades de una llegada o salida no se editan: se elimina y se registra de nuevo, así el kardex siempre cuadra.

`stock` y `movimientos` **no se editan a mano**. Si quieres cargar un saldo inicial, hazlo como una "Llegada → Compra directa" desde la app, así queda en el kardex.

## Importar una cotización → orden de compra en PDF

Órdenes de compra → **Importar cotización**:

1. **Cargar**: suelta el PDF que manda el proveedor (WhatsApp o correo) o pega el texto del chat.
   La app lee proveedor y RUC, n° de cotización, moneda, forma de pago y cada producto (código, cantidad, unidad, marca y precio).
   Avisa si algo no cuadra (cantidad × precio ≠ total, o la suma ≠ subtotal).
2. **Revisar y editar**: desmarca lo que no se compra, cambia cantidades y precios, agrega filas. Cada producto se empareja con el catálogo
   (mismo código o nombre parecido) o se marca para crearlo. Si el proveedor no existe, se registra con su RUC.
3. **Vista previa del PDF** y **Aprobar, guardar y descargar**: se crean los productos y el proveedor que falten, se guarda la orden
   con su número (`2026-0219`) y se descarga el PDF con el formato de COLD WORK.

Cualquier orden guardada tiene **Ver PDF** en su detalle.

- **Logo**: guarda el logo oficial como `frontend/public/documentos/logo-coldwork.png`; si no está, el PDF dibuja "COLD WORK".
- **Dirección, celular, gerente, notas del pie**: `frontend/src/app/modules/logistica/config/documento-oc.ts`.
- **Fotos o escaneos**: el lector necesita un PDF con texto (como el de Frío). Una foto no tiene texto: pega el mensaje o escribe las filas.

### Dólares y tipo de cambio

Una orden puede estar en **US$**. Al registrar su llegada se pide el **tipo de cambio del día**: el costo entra al inventario en soles
(precio × tipo de cambio), así el costo promedio nunca mezcla monedas. La llegada guarda la moneda y el tipo de cambio usado.

## Orden recomendado para cargar datos

1. Almacenes (al menos el principal y una unidad móvil por técnico).
2. Proveedores.
3. Productos, con su stock mínimo.
4. Saldo inicial: Llegadas → "Compra directa u otro ingreso".

## Dónde está el código

```
backend/src/modules/logistica/
├── controllers/   rutas HTTP  /api/v1/logistica/...
├── services/      reglas de negocio
├── repositories/  consultas a Supabase
├── dto/           lo que entra y sale de la API (validado)
├── entities/      forma de las tablas
└── logistica.module.ts

frontend/src/app/modules/logistica/
├── logistica.routes.ts · logistica.theme.scss
├── models/        interfaces (= DTOs del backend)
├── services/      llamadas a la API + LogisticaStore (catálogos compartidos)
├── views/         panel, inventario, llegadas, salidas, ordenes-compra, proveedores, almacenes
└── components/    asistentes de llegada y salida, kardex, diálogos, gráficos
```
