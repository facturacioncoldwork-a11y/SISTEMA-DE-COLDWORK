/**
 * Datos fijos del formato de ORDEN DE COMPRA de COLD WORK (el PDF).
 * La razón social y el RUC salen de la empresa actual; esto completa lo demás.
 * Cámbialo aquí si cambia la dirección, el gerente o las notas.
 *
 * Logo: guarda el logo oficial como `frontend/public/documentos/logo-coldwork.png`
 * (fondo blanco o transparente, ~600×200 px). Si no existe, el PDF dibuja el
 * nombre "COLD WORK – Refrigeración industrial".
 */
export const DOCUMENTO_OC = {
  razonSocial: 'COLD WORK S.A.C.',
  ruc: '20608689941',
  direccion: 'URB. SAN ILDEFONSO III ET. MZ. E1 LT 14 LA TINGUIÑA-ICA',
  celular: '932234166',
  /** Firma izquierda (aprueba). */
  gerenteGeneral: 'YHAN CARLOS GARCIA SALAS',
  cargoGerente: 'Gerente General',
  /** Firma derecha. */
  cargoCompras: 'Jefe de Compras y Servicios',
  /** "Aprobado por" al pie. */
  aprobadoPor: 'YHAN CARLOS GARCIA S.',
  lugarEntregaPorDefecto: 'ICA',
  condicionesPorDefecto: 'Contado',
  notas: [
    'Validar los precios antes de realizar el despacho',
    'A cada despacho adjuntar una copia de la orden de compra',
    'A cada producto a despachar adjuntar Guía de Remisión y Factura',
  ],
  logo: 'documentos/logo-coldwork.png',
} as const;
