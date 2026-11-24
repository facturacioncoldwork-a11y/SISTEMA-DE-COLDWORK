import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TerceroDialogo } from '../../components/tercero-dialogo/tercero-dialogo';
import type { Tercero } from '../../models/finanzas.model';
import { FinanzasStore } from '../../services/finanzas-store.service';

type Filtro = 'todos' | 'clientes' | 'proveedores';
const COLORES = ['#0ea5e9', '#6366f1', '#14b8a6', '#f59e0b', '#ec4899', '#8b5cf6', '#10b981'];

/** Vista: clientes y proveedores (una sola ficha por RUC/DNI, compartida con Logística). */
@Component({
  selector: 'app-terceros',
  imports: [FormsModule, TerceroDialogo],
  templateUrl: './terceros.html',
  styleUrl: './terceros.scss',
})
export class Terceros implements OnInit {
  protected readonly store = inject(FinanzasStore);
  private readonly ruta = inject(ActivatedRoute);

  protected readonly texto = signal('');
  protected readonly filtro = signal<Filtro>('todos');
  protected readonly verInactivos = signal(false);
  protected readonly dialogo = signal(false);
  protected readonly editando = signal<Tercero | null>(null);

  protected readonly lista = computed(() => {
    const t = this.texto().trim().toLowerCase();
    return this.store
      .terceros()
      .filter((x) => this.verInactivos() || x.activo)
      .filter((x) => this.filtro() === 'todos' || (this.filtro() === 'clientes' ? x.esCliente : x.esProveedor))
      .filter((x) => !t || [x.razonSocial, x.numeroDocumento, x.rubro, x.contacto].join(' ').toLowerCase().includes(t));
  });

  protected readonly cuenta = computed(() => ({
    todos: this.store.terceros().filter((x) => x.activo).length,
    clientes: this.store.clientes().length,
    proveedores: this.store.proveedores().length,
  }));

  async ngOnInit() {
    await this.store.asegurar();
    if (this.ruta.snapshot.queryParamMap.get('nuevo')) this.abrir(null);
  }

  protected abrir(t: Tercero | null) {
    this.editando.set(t);
    this.dialogo.set(true);
  }

  protected async guardado() {
    await this.store.recargar();
    this.store.ok('Guardado');
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
