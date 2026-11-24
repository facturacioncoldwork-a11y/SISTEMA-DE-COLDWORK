import { Injectable } from '@nestjs/common';
import { datosOError } from '../../../common/index.js';
import { SupabaseService } from '../../../database/supabase/supabase.service.js';
import type { AjustesLogisticaEntity } from '../entities/index.js';

/** Acceso a datos de `logistica_ajustes`. */
@Injectable()
export class AjustesRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async obtener(
    token: string,
    empresaId: string,
  ): Promise<AjustesLogisticaEntity | null> {
    const r = await this.supabase
      .paraUsuario(token)
      .from('logistica_ajustes')
      .select('empresa_id, meses_antiguedad')
      .eq('empresa_id', empresaId)
      .maybeSingle<AjustesLogisticaEntity>();
    return datosOError(r) ?? null;
  }

  /** Crea o actualiza la fila de la empresa (RLS: solo dueño o admin). */
  async guardar(token: string, fila: AjustesLogisticaEntity): Promise<void> {
    datosOError(
      await this.supabase
        .paraUsuario(token)
        .from('logistica_ajustes')
        .upsert(fila, { onConflict: 'empresa_id' })
        .select('empresa_id')
        .single(),
    );
  }
}
