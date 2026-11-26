import { inject, Injectable, signal } from '@angular/core';
import { EmpresaActualService } from '../../../core/empresa/services/empresa-actual.service';
import { SupabaseService } from '../../../core/supabase/services/supabase.service';

const BUCKET = 'ope-fotos';
/** Lado mayor de la foto al subirla: se ve nítida en el informe y pesa ~150-300 KB (rápido con datos móviles). */
const LADO_MAX = 1600;
/** Los enlaces firmados vencen; se renuevan antes. */
const VIGENCIA_S = 3600;

/**
 * Fotos de los informes en un bucket PRIVADO de Supabase (carpeta = empresa). Solo las ven los
 * miembros con área técnica o Ventas de esa empresa (lo exige la base de datos); se muestran
 * con enlaces firmados que vencen en una hora. Una foto subida no se reemplaza ni se borra.
 */
@Injectable({ providedIn: 'root' })
export class FotosService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly empresa = inject(EmpresaActualService);
  private readonly enlaces = signal<Record<string, string>>({});
  private readonly pedidos = new Set<string>();

  /** Comprime la foto en el celular y la sube. Devuelve la ruta que se guarda en el informe. */
  async subir(ordenId: string, archivo: File): Promise<string> {
    const empresa = this.empresa.id();
    if (!empresa) throw new Error('Sin empresa');
    const blob = await comprimir(archivo);
    const ruta = `${empresa}/${ordenId}/${crypto.randomUUID()}.jpg`;
    const { error } = await this.supabase.storage.from(BUCKET).upload(ruta, blob, { contentType: 'image/jpeg', upsert: false });
    if (error) throw new Error('No se pudo subir la foto');
    this.enlaces.update((m) => ({ ...m, [ruta]: URL.createObjectURL(blob) }));
    return ruta;
  }

  /** Enlace para mostrar la foto (se pide una vez y se reutiliza). */
  url(ruta: string): string {
    if (!ruta || ruta.startsWith('blob:') || ruta.startsWith('data:')) return ruta;
    const u = this.enlaces()[ruta];
    if (!u && !this.pedidos.has(ruta)) {
      this.pedidos.add(ruta);
      void this.supabase.storage
        .from(BUCKET)
        .createSignedUrl(ruta, VIGENCIA_S)
        .then(({ data }) => {
          if (data?.signedUrl) this.enlaces.update((m) => ({ ...m, [ruta]: data.signedUrl }));
          setTimeout(() => this.pedidos.delete(ruta), (VIGENCIA_S - 120) * 1000);
        });
    }
    return u ?? '';
  }

  /** Enlaces de varias fotos ya listos (para el PDF). */
  async urls(rutas: string[]): Promise<Record<string, string>> {
    const faltan = rutas.filter((r) => !this.enlaces()[r]);
    if (faltan.length) {
      const { data } = await this.supabase.storage.from(BUCKET).createSignedUrls(faltan, VIGENCIA_S);
      const nuevos: Record<string, string> = {};
      for (const d of data ?? []) if (d.path && d.signedUrl) nuevos[d.path] = d.signedUrl;
      this.enlaces.update((m) => ({ ...m, ...nuevos }));
    }
    return this.enlaces();
  }
}

async function comprimir(archivo: File): Promise<Blob> {
  const img = await createImageBitmap(archivo);
  const escala = Math.min(1, LADO_MAX / Math.max(img.width, img.height));
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(img.width * escala);
  lienzo.height = Math.round(img.height * escala);
  lienzo.getContext('2d')!.drawImage(img, 0, 0, lienzo.width, lienzo.height);
  img.close();
  return new Promise((ok, mal) => lienzo.toBlob((b) => (b ? ok(b) : mal(new Error('No se pudo leer la foto'))), 'image/jpeg', 0.8));
}
