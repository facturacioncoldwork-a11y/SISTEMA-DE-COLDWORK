/**
 * Worker de Cloudflare que sirve la app (archivos estáticos) y, cada 5 minutos, avisa al
 * backend de Render para que no se duerma (en el plan gratis se apaga tras 15 min sin uso y
 * despertarlo tarda 30-60 s: esa era la demora al abrir la app). Los cron de Cloudflare son
 * puntuales; los de GitHub se atrasan o se saltan.
 *
 * No toca datos ni usa credenciales: solo llama a /api/health, que es público.
 */
export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },

  async scheduled(_evento, env, ctx) {
    if (!env.API_SALUD) return;
    ctx.waitUntil(fetch(env.API_SALUD, { headers: { 'User-Agent': 'coldwork-despertador' } }).catch(() => undefined));
  },
};
