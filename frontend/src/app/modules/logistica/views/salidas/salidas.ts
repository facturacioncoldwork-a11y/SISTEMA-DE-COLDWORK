import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { usarConfirmacion } from '../../services/confirmar';
import { SalidaAsistente } from '../../components/salida-asistente/salida-asistente';
import { MOTIVOS_SALIDA, type MotivoSalida, type Salida } from '../../models/logistica.model';
import { LogisticaStore } from '../../services/logistica-store.service';
import { MovimientosService } from '../../services/movimientos.service';

/** Vista: SALIDA DE PRODUCTO / despachos (historial + asistente). */
@Component({
  selector: 'app-salidas',
  imports: [
    FormsModule,
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    DialogModule,
    InputTextModule,
    SalidaAsistente,
  ],
  templateUrl: './salidas.html',
  styleUrl: './documentos.scss',
})
export class Salidas implements OnInit {
  private readonly api = inject(MovimientosService);
  private readonly store = inject(LogisticaStore);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly motivos = MOTIVOS_SALIDA;
  protected readonly listaMotivos = Object.entries(MOTIVOS_SALIDA).map(([clave, m]) => ({
    clave: clave as MotivoSalida,
    ...m,
  }));
  protected readonly salidas = signal<Salida[]>([]);
  protected readonly cargando = signal(true);
  protected readonly texto = signal('');
  protected readonly motivo = signal<MotivoSalida | null>(null);
  protected readonly abierta = signal<string | null>(null);
  protected readonly asistente = signal(false);
  private readonly confirmar = usarConfirmacion();

  protected readonly editando = signal<Salida | null>(null);
  protected readonly edDestino = signal('');
  protected readonly edResponsable = signal('');
  protected readonly edReferencia = signal('');
  protected readonly edNotas = signal('');
  protected readonly guardando = signal(false);

  protected readonly lista = computed(() => {
    const t = this.texto().trim().toLowerCase();
    const m = this.motivo();
    return this.salidas().filter(
      (s) =>
        (!m || s.motivo === m) &&
        (!t ||
          [
            s.codigo,
            s.destino,
            s.responsable,
            s.referencia,
            s.almacenDestino?.nombre,
            ...s.lineas.map((x) => x.nombre),
          ]
            .join(' ')
            .toLowerCase()
            .includes(t)),
    );
  });
  protected readonly porMotivo = computed(() => {
    const c = new Map<MotivoSalida, number>();
    for (const s of this.salidas()) c.set(s.motivo, (c.get(s.motivo) ?? 0) + 1);
    return c;
  });
  protected readonly delMes = computed(() => {
    const mes = new Date().toISOString().slice(0, 7);
    const l = this.salidas().filter((x) => x.fecha.startsWith(mes) && x.motivo !== 'transferencia');
    return { n: l.length, valor: l.reduce((t, x) => t + x.total, 0) };
  });

  async ngOnInit() {
    await Promise.all([this.cargar(), this.store.asegurar()]);
    if (this.ruta.snapshot.queryParamMap.get('nuevo')) this.abrir();
  }

  async cargar() {
    this.cargando.set(true);
    try {
      this.salidas.set(await this.api.salidas());
    } catch (e) {
      this.store.error('No se pudieron cargar las salidas', e);
    } finally {
      this.cargando.set(false);
    }
  }

  protected abrir() {
    this.asistente.set(true);
    void this.router.navigate([], { queryParams: {}, replaceUrl: true });
  }

  protected alRegistrar(s: Salida) {
    this.abierta.set(s.id);
    void this.cargar();
  }

  protected editar(s: Salida) {
    this.edDestino.set(s.destino ?? '');
    this.edResponsable.set(s.responsable ?? '');
    this.edReferencia.set(s.referencia ?? '');
    this.edNotas.set(s.notas ?? '');
    this.editando.set(s);
  }

  protected async guardarEdicion() {
    const s = this.editando();
    if (!s) return;
    this.guardando.set(true);
    try {
      const r = await this.api.actualizarSalida(s.id, {
        destino: this.edDestino(),
        responsable: this.edResponsable(),
        referencia: this.edReferencia(),
        notas: this.edNotas(),
      });
      this.salidas.update((x) => x.map((y) => (y.id === r.id ? r : y)));
      this.editando.set(null);
      this.store.ok('Salida actualizada', r.codigo);
    } catch (e) {
      this.store.error('No se pudo guardar', e);
    } finally {
      this.guardando.set(false);
    }
  }

  /** DELETE real: la BD devuelve el stock al almacén (en transferencias, lo quita del destino). */
  protected async eliminar(s: Salida) {
    const ok = await this.confirmar(
      `¿Eliminar ${s.codigo}?`,
      s.motivo === 'transferencia'
        ? `Se borra de la base de datos y el stock regresa de ${s.almacenDestino?.nombre} a ${s.almacen.nombre}.`
        : `Se borra de la base de datos y los ${s.lineas.length} productos vuelven al stock de ${s.almacen.nombre}.`,
    );
    if (!ok) return;
    try {
      await this.api.eliminarSalida(s.id);
      this.store.ok('Salida eliminada', `${s.codigo}: stock devuelto`);
      await Promise.all([this.cargar(), this.store.recargar()]);
    } catch (e) {
      this.store.error('No se pudo eliminar', e);
    }
  }

  protected alternar(id: string) {
    this.abierta.update((a) => (a === id ? null : id));
  }
}
