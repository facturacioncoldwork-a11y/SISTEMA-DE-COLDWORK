import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { EmpresaActualService } from '../../../../core/empresa/services/empresa-actual.service';
import { AREAS, NOMBRE_ROL, veTodo, type Area } from '../../../../core/permisos/areas';
import { Contador } from '../../../../shared/components/contador/contador';
import { Emoji } from '../../../../shared/components/emoji/emoji';
import type { NombreIcono } from '../../../../shared/components/emoji/iconos';
import type { OrdenCompra, ResumenLogistica } from '../../../logistica/models/logistica.model';
import { colorLlegada, seguimiento } from '../../../logistica/models/plazos';
import { OrdenesCompraService } from '../../../logistica/services/ordenes-compra.service';
import { ProductosService } from '../../../logistica/services/productos.service';

interface TarjetaArea {
  clave: Area;
  nombre: string;
  descripcion: string;
  sticker: NombreIcono;
  ruta: string;
  colores: [string, string];
  lista: boolean;
}

/** Datos visuales por área (color, sticker y a dónde lleva). */
const VISUAL: Record<Area, Omit<TarjetaArea, 'clave' | 'nombre' | 'descripcion'>> = {
  logistica: { sticker: 'caja', ruta: '/logistica', colores: ['#06b6d4', '#6366f1'], lista: true },
  contabilidad: {
    sticker: 'libro',
    ruta: '/contabilidad',
    colores: ['#8b5cf6', '#d946ef'],
    lista: false,
  },
  finanzas: {
    sticker: 'dinero',
    ruta: '/caja-bancos',
    colores: ['#10b981', '#059669'],
    lista: false,
  },
  ventas: { sticker: 'grafico', ruta: '/ventas', colores: ['#f97316', '#ef4444'], lista: false },
  administracion: {
    sticker: 'edificio',
    ruta: '/terceros',
    colores: ['#0ea5e9', '#2563eb'],
    lista: false,
  },
  tecnica: {
    sticker: 'herramienta',
    ruta: '/servicios',
    colores: ['#f59e0b', '#ea580c'],
    lista: false,
  },
  personal: {
    sticker: 'persona',
    ruta: '/personal',
    colores: ['#ec4899', '#f43f5e'],
    lista: false,
  },
};

const CONSEJOS: {
  sticker: NombreIcono;
  titulo: string;
  texto: string;
  ruta?: string;
  query?: Record<string, number>;
}[] = [
  {
    sticker: 'cohete',
    titulo: 'Importa cotizaciones en segundos',
    texto:
      'Suelta el PDF que te manda el proveedor por WhatsApp y sale tu orden de compra con el formato de COLD WORK.',
    ruta: '/logistica/ordenes-compra',
    query: { importar: 1 },
  },
  {
    sticker: 'camion',
    titulo: '¿Cuándo llega lo que pediste?',
    texto:
      'Pon el plazo como lo dijo el proveedor ("2-3 semanas") y el sistema calcula la fecha y te avisa si se atrasa.',
    ruta: '/logistica/ordenes-compra',
  },
  {
    sticker: 'idea',
    titulo: 'El stock siempre cuadra',
    texto:
      'Si eliminas una llegada o una salida, el sistema devuelve el stock y corrige el kardex solo.',
  },
  {
    sticker: 'estrella',
    titulo: 'Dólares sin enredos',
    texto:
      'Las compras en US$ piden el tipo de cambio al llegar: tu inventario siempre queda valorizado en soles.',
  },
];

/** Vista: INICIO. Saludo según la hora, indicadores en vivo, áreas y atajos. */
@Component({
  selector: 'app-inicio',
  imports: [DatePipe, RouterLink, Emoji, Contador],
  templateUrl: './inicio.html',
  styleUrl: './inicio.scss',
})
export class Inicio implements OnInit {
  private readonly auth = inject(AuthService);
  protected readonly empresa = inject(EmpresaActualService);
  private readonly productosApi = inject(ProductosService);
  private readonly ocApi = inject(OrdenesCompraService);

  protected readonly nombreRol = NOMBRE_ROL;
  protected readonly ahora = signal(new Date());
  protected readonly consejos = CONSEJOS;
  protected readonly consejo = signal(0);
  protected readonly resumen = signal<ResumenLogistica | null>(null);
  protected readonly ordenes = signal<OrdenCompra[]>([]);
  protected readonly colorLlegada = colorLlegada;

  protected readonly nombre = computed(() => {
    return this.auth.nombre().split(' ')[0];
  });

  /** Mañana / tarde / noche: cambia saludo, color y sticker. */
  protected readonly momento = computed(() => {
    const h = this.ahora().getHours();
    if (h >= 5 && h < 12)
      return { saludo: 'Buenos días', sticker: 'sol' as NombreIcono, clase: 'manana' };
    if (h >= 12 && h < 19)
      return { saludo: 'Buenas tardes', sticker: 'saludo' as NombreIcono, clase: 'tarde' };
    return { saludo: 'Buenas noches', sticker: 'luna' as NombreIcono, clase: 'noche' };
  });

  protected readonly esDueno = computed(() => this.empresa.rol() === 'dueno');
  protected readonly logistica = computed(() => {
    this.empresa.actual();
    return this.empresa.puede('logistica');
  });

  /** Solo las áreas a las que la persona tiene acceso. */
  protected readonly areas = computed<TarjetaArea[]>(() => {
    this.empresa.actual();
    return AREAS.filter((a) => this.empresa.puede(a.clave)).map((a) => ({
      clave: a.clave,
      nombre: a.nombre,
      descripcion: a.descripcion,
      ...VISUAL[a.clave],
    }));
  });
  protected readonly misAreas = computed(() => {
    const e = this.empresa.actual();
    return !e || veTodo(e.rol)
      ? 'todas las áreas'
      : this.areas()
          .map((a) => a.nombre)
          .join(', ') || 'ninguna todavía';
  });

  /** En camino, lo más urgente primero. */
  protected readonly proximas = computed(() =>
    this.ordenes()
      .filter((o) => o.estado === 'enviada' || o.estado === 'parcial')
      .map((o) => ({ o, s: seguimiento(o) }))
      .sort((a, b) => (a.o.entregaHasta ?? '9999').localeCompare(b.o.entregaHasta ?? '9999'))
      .slice(0, 4),
  );
  protected readonly atrasadas = computed(
    () => this.proximas().filter((x) => x.s.llegada === 'atrasada').length,
  );

  constructor() {
    const reloj = setInterval(() => this.ahora.set(new Date()), 30_000);
    const giro = setInterval(() => this.consejo.update((i) => (i + 1) % CONSEJOS.length), 7000);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(reloj);
      clearInterval(giro);
    });
  }

  async ngOnInit() {
    await this.empresa.asegurar().catch(() => []);
    if (!this.empresa.puede('logistica')) return;
    const [r, o] = await Promise.allSettled([this.productosApi.resumen(), this.ocApi.listar()]);
    if (r.status === 'fulfilled') this.resumen.set(r.value);
    if (o.status === 'fulfilled') this.ordenes.set(o.value);
  }

  protected inclinar(e: PointerEvent) {
    const el = e.currentTarget as HTMLElement;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--rx', `${((e.clientY - r.top) / r.height - 0.5) * -8}deg`);
    el.style.setProperty('--ry', `${((e.clientX - r.left) / r.width - 0.5) * 8}deg`);
  }
  protected soltar(e: PointerEvent) {
    const el = e.currentTarget as HTMLElement;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  }
}
