# Créditos de stickers y emojis

Los stickers/emojis se cargan **por link** (`frontend/src/app/shared/components/emoji/iconos.ts`). Cada uno prueba en orden:

1. **Noto Emoji animado** de Google (`fonts.gstatic.com`) — licencia Apache 2.0 / OFL.
2. **Twemoji** (`cdn.jsdelivr.net/gh/jdecked/twemoji`) — gráficos con licencia **CC BY 4.0**, que pide atribución: por eso el login muestra "Emojis: Noto (Google) y Twemoji (CC BY 4.0)".
3. **Copia propia** en `frontend/public/emojis/<nombre>.svg` (dibujos del proyecto), por si la red del cliente bloquea sitios externos. Así nunca se ve un ícono roto.

También se puede usar el link de cualquier página: `<app-emoji url="https://…/sticker.gif" nombre="estrella" />` (si ese link falla, cae al catálogo). Antes de usar una imagen de otra página, revisa que su licencia permita usarla.

El **logo** oficial está en `frontend/public/documentos/logo-coldwork.png` (lo usan el menú, el login y el PDF de la orden de compra).

Los íconos de interfaz (botones y menú) son **PrimeIcons** (MIT).
