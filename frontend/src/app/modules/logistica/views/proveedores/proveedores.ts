import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ProveedorDialogo } from '../../components/proveedor-dialogo/proveedor-dialogo';
import type { Proveedor } from '../../models/logistica.model';
import { LogisticaStore } from '../../services/logistica-store.service';

const COLORES = ['#0ea5e9', '#6366f1', '#14b8a6', '#f59e0b', '#ec4899', '#8b5cf6', '#10b981'];

/** Vista: GESTIÓN DE PROVEEDORES. */
@Component({
  selector: 'app-proveedores',
  imports: [FormsModule, ProveedorDialogo],
  templateUrl: './proveedores.html',
  styleUrl: './proveedores.scss',
})
export class Proveedores implements OnInit {
  protected readonly store = inject(LogisticaStore);
  private readonly ruta = inject(ActivatedRoute);

  protected readonly texto = signal('');
  protected readonly verInactivos = signal(false);
  protected readonly dialogo = signal(false);
  protected readonly editando = signal<Proveedor | null>(null);

  protected readonly lista = computed(() => {
    const t = this.texto().trim().toLowerCase();
    return this.store
      .proveedores()
      .filter((p) => this.verInactivos() || p.activo)
      .filter(
        (p) =>
          !t ||
          [p.razonSocial, p.numeroDocumento, p.rubro, p.contacto]
            .join(' ')
            .toLowerCase()
            .includes(t),
      );
  });

  async ngOnInit() {
    await this.store.asegurar();
    if (this.ruta.snapshot.queryParamMap.get('nuevo')) this.abrir(null);
  }

  protected abrir(p: Proveedor | null) {
    this.editando.set(p);
    this.dialogo.set(true);
  }

  protected iniciales(nombre: string): string {
    return nombre
      .replace(/S\.?A\.?C?\.?|E\.?I\.?R\.?L\.?|S\.?R\.?L\.?/gi, '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((x) => x[0])
      .join('')
      .toUpperCase();
  }

  protected color(nombre: string): string {
    let h = 0;
    for (const c of nombre) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return COLORES[h % COLORES.length];
  }

  protected whatsapp(tel: string): string {
    const n = tel.replace(/\D/g, '');
    return `https://wa.me/${n.length === 9 ? '51' + n : n}`;
  }
}
