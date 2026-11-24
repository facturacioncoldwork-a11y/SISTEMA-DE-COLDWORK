-- Ajuste menor (aviso de `supabase db lint`): el ayudante que cuadra céntimos usa
-- funciones jsonb "stable", así que se declara stable en lugar de immutable.
alter function public._fin_cuadrar(jsonb) stable;
