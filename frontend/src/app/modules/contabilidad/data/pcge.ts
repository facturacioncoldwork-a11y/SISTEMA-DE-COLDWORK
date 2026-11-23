import type { Cuenta, Elemento, Naturaleza } from '../models/contabilidad.model';

/**
 * Plan Contable General Empresarial (PCGE) — versión modificada 2019
 * (Res. N.° 002-2019-EF/30 del Consejo Normativo de Contabilidad).
 *
 * Catálogo base: todas las cuentas de 2 dígitos y las subcuentas y divisionarias
 * que más usa una empresa de servicios de refrigeración. Cada empresa podrá
 * agregar sus propias subcuentas cuando el módulo se conecte a la base de datos.
 */

export const ELEMENTOS: Elemento[] = [
  { numero: 1, nombre: 'Activo disponible y exigible' },
  { numero: 2, nombre: 'Activo realizable' },
  { numero: 3, nombre: 'Activo inmovilizado' },
  { numero: 4, nombre: 'Pasivo' },
  { numero: 5, nombre: 'Patrimonio' },
  { numero: 6, nombre: 'Gastos por naturaleza' },
  { numero: 7, nombre: 'Ingresos' },
  { numero: 8, nombre: 'Saldos intermediarios de gestión y resultado' },
  { numero: 9, nombre: 'Contabilidad analítica de explotación' },
];

/** [código, nombre] en orden del PCGE. */
const FILAS: readonly [string, string][] = [
  // Elemento 1 — Activo disponible y exigible
  ['10', 'Efectivo y equivalentes de efectivo'],
  ['101', 'Caja'],
  ['104', 'Cuentas corrientes en instituciones financieras'],
  ['1041', 'Cuentas corrientes operativas'],
  ['1042', 'Cuentas corrientes para fines específicos (detracciones)'],
  ['11', 'Inversiones financieras'],
  ['12', 'Cuentas por cobrar comerciales – terceros'],
  ['121', 'Facturas, boletas y otros comprobantes por cobrar'],
  ['1212', 'Emitidas en cartera'],
  ['1213', 'En cobranza'],
  ['122', 'Anticipos de clientes'],
  ['13', 'Cuentas por cobrar comerciales – relacionadas'],
  ['14', 'Cuentas por cobrar al personal, accionistas, directores y gerentes'],
  ['141', 'Personal'],
  ['16', 'Cuentas por cobrar diversas – terceros'],
  ['17', 'Cuentas por cobrar diversas – relacionadas'],
  ['18', 'Servicios y otros contratados por anticipado'],
  ['182', 'Seguros'],
  ['19', 'Estimación de cuentas de cobranza dudosa'],

  // Elemento 2 — Activo realizable
  ['20', 'Mercaderías'],
  ['201', 'Mercaderías manufacturadas'],
  ['21', 'Productos terminados'],
  ['22', 'Subproductos, desechos y desperdicios'],
  ['23', 'Productos en proceso'],
  ['24', 'Materias primas'],
  ['25', 'Materiales auxiliares, suministros y repuestos'],
  ['252', 'Suministros'],
  ['253', 'Repuestos'],
  ['26', 'Envases y embalajes'],
  ['27', 'Activos no corrientes mantenidos para la venta'],
  ['28', 'Inventarios por recibir'],
  ['29', 'Desvalorización de inventarios'],

  // Elemento 3 — Activo inmovilizado
  ['30', 'Inversiones mobiliarias'],
  ['31', 'Propiedades de inversión'],
  ['32', 'Activos por derecho de uso'],
  ['33', 'Propiedad, planta y equipo'],
  ['333', 'Maquinarias y equipos de explotación'],
  ['334', 'Unidades de transporte'],
  ['335', 'Muebles y enseres'],
  ['336', 'Equipos diversos'],
  ['3361', 'Equipo para procesamiento de información'],
  ['3369', 'Otros equipos'],
  ['34', 'Intangibles'],
  ['35', 'Activos biológicos'],
  ['36', 'Desvalorización de activo inmovilizado'],
  ['37', 'Activo diferido'],
  ['38', 'Otros activos'],
  ['39', 'Depreciación, amortización y agotamiento acumulados'],
  ['391', 'Depreciación acumulada'],
  ['3913', 'Propiedad, planta y equipo – costo'],

  // Elemento 4 — Pasivo
  ['40', 'Tributos, contraprestaciones y aportes al sistema de pensiones y de salud por pagar'],
  ['401', 'Gobierno central'],
  ['4011', 'Impuesto general a las ventas'],
  ['40111', 'IGV – Cuenta propia'],
  ['4017', 'Impuesto a la renta'],
  ['40171', 'Renta de tercera categoría'],
  ['40172', 'Renta de cuarta categoría'],
  ['40173', 'Renta de quinta categoría'],
  ['403', 'Instituciones públicas'],
  ['4031', 'ESSALUD'],
  ['4032', 'ONP'],
  ['407', 'Administradoras de fondos de pensiones (AFP)'],
  ['41', 'Remuneraciones y participaciones por pagar'],
  ['411', 'Remuneraciones por pagar'],
  ['4111', 'Sueldos y salarios por pagar'],
  ['42', 'Cuentas por pagar comerciales – terceros'],
  ['421', 'Facturas, boletas y otros comprobantes por pagar'],
  ['4212', 'Emitidas'],
  ['424', 'Honorarios por pagar'],
  ['43', 'Cuentas por pagar comerciales – relacionadas'],
  ['44', 'Cuentas por pagar a los accionistas, directores y gerentes'],
  ['45', 'Obligaciones financieras'],
  ['451', 'Préstamos de instituciones financieras'],
  ['46', 'Cuentas por pagar diversas – terceros'],
  ['47', 'Cuentas por pagar diversas – relacionadas'],
  ['48', 'Provisiones'],
  ['49', 'Pasivo diferido'],

  // Elemento 5 — Patrimonio
  ['50', 'Capital'],
  ['501', 'Capital social'],
  ['5011', 'Acciones'],
  ['51', 'Acciones de inversión'],
  ['52', 'Capital adicional'],
  ['56', 'Resultados no realizados'],
  ['57', 'Excedente de revaluación'],
  ['58', 'Reservas'],
  ['582', 'Legal'],
  ['59', 'Resultados acumulados'],
  ['591', 'Utilidades no distribuidas'],
  ['592', 'Pérdidas acumuladas'],

  // Elemento 6 — Gastos por naturaleza
  ['60', 'Compras'],
  ['601', 'Mercaderías'],
  ['603', 'Materiales auxiliares, suministros y repuestos'],
  ['6032', 'Suministros'],
  ['6033', 'Repuestos'],
  ['609', 'Costos vinculados con las compras'],
  ['61', 'Variación de inventarios'],
  ['611', 'Mercaderías'],
  ['613', 'Materiales auxiliares, suministros y repuestos'],
  ['62', 'Gastos de personal y directores'],
  ['621', 'Remuneraciones'],
  ['6211', 'Sueldos y salarios'],
  ['627', 'Seguridad, previsión social y otras contribuciones'],
  ['6271', 'Régimen de prestaciones de salud (ESSALUD)'],
  ['63', 'Gastos de servicios prestados por terceros'],
  ['631', 'Transporte, correos y gastos de viaje'],
  ['632', 'Honorarios, comisiones y corretajes'],
  ['634', 'Mantenimiento y reparaciones'],
  ['635', 'Alquileres'],
  ['636', 'Servicios básicos'],
  ['6361', 'Energía eléctrica'],
  ['6363', 'Agua'],
  ['6364', 'Teléfono e internet'],
  ['64', 'Gastos por tributos'],
  ['641', 'Gobierno central'],
  ['65', 'Otros gastos de gestión'],
  ['659', 'Otros gastos de gestión'],
  ['66', 'Pérdida por medición de activos no financieros al valor razonable'],
  ['67', 'Gastos financieros'],
  ['673', 'Intereses por préstamos y otras obligaciones'],
  ['676', 'Diferencia de cambio'],
  ['68', 'Valuación y deterioro de activos y provisiones'],
  ['681', 'Depreciación'],
  ['6814', 'Depreciación de propiedad, planta y equipo – costo'],
  ['69', 'Costo de ventas'],
  ['691', 'Mercaderías'],

  // Elemento 7 — Ingresos
  ['70', 'Ventas'],
  ['701', 'Mercaderías'],
  ['7011', 'Mercaderías manufacturadas'],
  ['704', 'Prestación de servicios'],
  ['7041', 'Terceros'],
  ['71', 'Variación de la producción almacenada'],
  ['72', 'Producción de activo inmovilizado'],
  ['73', 'Descuentos, rebajas y bonificaciones obtenidos'],
  ['74', 'Descuentos, rebajas y bonificaciones concedidos'],
  ['75', 'Otros ingresos de gestión'],
  ['759', 'Otros ingresos de gestión'],
  ['76', 'Ganancia por medición de activos no financieros al valor razonable'],
  ['77', 'Ingresos financieros'],
  ['776', 'Diferencia en cambio'],
  ['78', 'Cargas cubiertas por provisiones'],
  ['79', 'Cargas imputables a cuentas de costos y gastos'],
  ['791', 'Cargas imputables a cuentas de costos y gastos'],

  // Elemento 8 — Saldos intermediarios y resultado
  ['80', 'Margen comercial'],
  ['81', 'Producción del ejercicio'],
  ['82', 'Valor agregado'],
  ['83', 'Excedente bruto (insuficiencia bruta) de explotación'],
  ['84', 'Resultado de explotación'],
  ['85', 'Resultado antes de participaciones e impuestos'],
  ['88', 'Impuesto a la renta'],
  ['89', 'Determinación del resultado del ejercicio'],
  ['891', 'Utilidad'],
  ['892', 'Pérdida'],

  // Elemento 9 — Contabilidad analítica (destino)
  ['92', 'Costos de producción'],
  ['94', 'Gastos de administración'],
  ['95', 'Gastos de ventas'],
  ['97', 'Gastos financieros'],
];

/** Cuentas que van contra su elemento (estimaciones, depreciación, descuentos concedidos…). */
const NATURALEZA_ESPECIAL: Record<string, Naturaleza> = {
  '19': 'acreedora',
  '29': 'acreedora',
  '36': 'acreedora',
  '39': 'acreedora',
  '74': 'deudora',
  '79': 'acreedora',
};

function naturalezaDe(codigo: string): Naturaleza {
  const especial = NATURALEZA_ESPECIAL[codigo.slice(0, 2)];
  if (especial) return especial;
  return [4, 5, 7].includes(Number(codigo[0])) ? 'acreedora' : 'deudora';
}

/** Catálogo listo para usar, con naturaleza, nivel y si recibe movimientos. */
export const PCGE: Cuenta[] = FILAS.map(([codigo, nombre]) => {
  const tieneHijas = FILAS.some(([otro]) => otro.length > codigo.length && otro.startsWith(codigo));
  return {
    codigo,
    nombre,
    elemento: Number(codigo[0]),
    naturaleza: naturalezaDe(codigo),
    movimiento: codigo.length >= 3 && !tieneHijas,
    nivel: codigo.length - 1,
  };
});
