/**
 * Catálogo de stickers/emojis de COLDWORK, cargados POR LINK.
 *
 * Cada nombre prueba estas fuentes en orden hasta que una cargue:
 *  1. Google Noto ANIMADO (fonts.gstatic.com) — stickers que se mueven.
 *  2. Twemoji (cdn.jsdelivr.net) — por si Google no responde.
 *  3. Copia propia en `public/emojis/<nombre>.svg` — si la red del cliente
 *     bloquea sitios externos; así nunca se ve un ícono roto.
 *
 * Para usar un sticker de cualquier otra página:  <app-emoji url="https://..." nombre="estrella" />
 * (si ese link falla, cae al catálogo de `nombre`).
 *
 * Para agregar uno: busca el código del emoji (ej. 🚀 = 1f680) y agrégalo aquí.
 * Lista de animados: https://googlefonts.github.io/noto-emoji-animation/
 */
interface Icono {
  /** Código para Noto animado (puntos de código con "_"). */
  noto: string;
  /** Código para Twemoji (puntos de código con "-", sin fe0f). */
  tw: string;
  /** Hay copia local en public/emojis. */
  local?: boolean;
}

export const ICONOS = {
  saludo: { noto: '1f44b', tw: '1f44b', local: true },
  copo: { noto: '2744_fe0f', tw: '2744', local: true },
  correo: { noto: '1f4e7', tw: '1f4e7', local: true },
  edificio: { noto: '1f3e2', tw: '1f3e2', local: true },
  cohete: { noto: '1f680', tw: '1f680', local: true },
  caja: { noto: '1f4e6', tw: '1f4e6', local: true },
  camion: { noto: '1f69a', tw: '1f69a', local: true },
  grafico: { noto: '1f4c8', tw: '1f4c8', local: true },
  estrella: { noto: '1f31f', tw: '1f31f', local: true },
  sol: { noto: '2600_fe0f', tw: '2600', local: true },
  luna: { noto: '1f319', tw: '1f319', local: true },
  idea: { noto: '1f4a1', tw: '1f4a1', local: true },
  fiesta: { noto: '1f389', tw: '1f389', local: true },
  reloj: { noto: '23f0', tw: '23f0', local: true },
  dinero: { noto: '1f4b0', tw: '1f4b0', local: true },
  herramienta: { noto: '1f6e0_fe0f', tw: '1f6e0', local: true },
  persona: { noto: '1f9d1_200d_1f527', tw: '1f9d1-200d-1f527', local: true },
  libro: { noto: '1f4d2', tw: '1f4d2', local: true },
} satisfies Record<string, Icono>;

export type NombreIcono = keyof typeof ICONOS;

/** Fuentes en orden de preferencia para un nombre del catálogo. */
export function fuentesEmoji(nombre: NombreIcono): string[] {
  const i: Icono = ICONOS[nombre];
  return [
    `https://fonts.gstatic.com/s/e/notoemoji/latest/${i.noto}/512.webp`,
    `https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/${i.tw}.svg`,
    ...(i.local ? [`emojis/${nombre}.svg`] : []),
  ];
}
