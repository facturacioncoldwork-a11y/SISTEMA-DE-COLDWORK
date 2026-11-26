import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { EmpresaActualService } from '../../../../core/empresa/services/empresa-actual.service';
import { AREAS, NOMBRE_ROL, veTodo } from '../../../../core/permisos/areas';
import { MENU } from '../../../../layout/shell/menu';
import { Contador } from '../../../../shared/components/contador/contador';
import { Emoji } from '../../../../shared/components/emoji/emoji';
import type { NombreIcono } from '../../../../shared/components/emoji/iconos';
import type { OrdenCompra, ResumenLogistica } from '../../../logistica/models/logistica.model';
import { colorLlegada, seguimiento } from '../../../logistica/models/plazos';
import { OrdenesCompraService } from '../../../logistica/services/ordenes-compra.service';
import { ProductosService } from '../../../logistica/services/productos.service';

/** Aspecto de cada sección del menú en Inicio (mismo orden y nombres que el menú lateral). */
const GRUPOS: Record<string, { descripcion: string; sticker: NombreIcono; colores: [string, string] }> = {
  Finanzas: { descripcion: 'Caja y bancos, ventas, compras, cobros y pagos', sticker: 'dinero', colores: ['#10b981', '#059669'] },
  Contabilidad: { descripcion: 'Asientos, libros y estados financieros', sticker: 'libro', colores: ['#8b5cf6', '#d946ef'] },
  'Almacén y logística': { descripcion: 'Inventario, llegadas, salidas y órdenes de compra', sticker: 'caja', colores: ['#06b6d4', '#6366f1'] },
  'Servicios y proyectos': { descripcion: 'Cotizaciones y cada servicio de principio a fin', sticker: 'grafico', colores: ['#f97316', '#ef4444'] },
  Operaciones: { descripcion: 'Órdenes de trabajo, informes técnicos y asistencia', sticker: 'herramienta', colores: ['#f59e0b', '#ea580c'] },
  Sistema: { descripcion: 'Equipo, accesos y datos de la empresa', sticker: 'estrella', colores: ['#0f172a', '#334155'] },
};

/** Cómo pasa la información de un área a otra (sin volver a escribirla). */
const FLUJOS: { titulo: string; pasos: string[] }[] = [
  { titulo: 'De la cotización al cobro', pasos: ['Cotización aprobada', 'Servicio con su forma de pago', 'Orden de trabajo e informe firmado', 'Factura en Ventas', 'Cobro en Caja', 'Asiento contable'] },
  { titulo: 'De la compra al pago', pasos: ['Orden de compra', 'Llegada al almacén (kardex)', 'Factura en Compras', 'Pago en Caja', 'Asiento contable'] },
  { titulo: 'Del personal a la planilla', pasos: ['Marca con GPS o código de tablet', 'Registro mensual', 'Horas extra y tardanzas', 'Planilla (PLAME)'] },
];

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

  /** Las mismas secciones del menú, solo con lo que la persona puede abrir. */
  protected readonly grupos = computed(() => {
    this.empresa.actual();
    return MENU.filter((g) => GRUPOS[g.titulo])
      .map((g) => ({
        titulo: g.titulo,
        ...GRUPOS[g.titulo],
        items: g.items.filter((i) =>
          i.soloDueno ? this.empresa.esDueno() : i.soloAdmin ? this.empresa.esAdmin() : !i.area || this.empresa.puede(i.area),
        ),
      }))
      .filter((g) => g.items.length > 0);
  });
  protected readonly flujos = FLUJOS;
  protected readonly misAreas = computed(() => {
    const e = this.empresa.actual();
    return !e || veTodo(e.rol)
      ? 'todas las áreas'
      : AREAS.filter((a) => this.empresa.puede(a.clave))
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
