import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { apiInterceptor } from './api.interceptor';
import { SupabaseService } from '../../supabase/services/supabase.service';
import { EmpresaActualService } from '../../empresa/services/empresa-actual.service';
import { cargarConfig } from '../../config/runtime-config';

describe('apiInterceptor', () => {
  let http: HttpClient;
  let ctrl: HttpTestingController;

  beforeEach(async () => {
    // config.json simulado (se carga igual que en la app real)
    vi.stubGlobal('fetch', async () =>
      new Response(JSON.stringify({ supabaseUrl: 'http://sb', supabaseKey: 'k', apiUrl: 'http://api/api/', entorno: 'test' })),
    );
    await cargarConfig();
    vi.unstubAllGlobals();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiInterceptor])),
        provideHttpClientTesting(),
        {
          provide: SupabaseService,
          useValue: { auth: { getSession: async () => ({ data: { session: { access_token: 'TOKEN' } } }) } },
        },
      ],
    });
    TestBed.inject(EmpresaActualService).cargar([{ id: 'E1', razonSocial: 'COLDWORK', ruc: null, rol: 'dueno', areas: [] }]);
    http = TestBed.inject(HttpClient);
    ctrl = TestBed.inject(HttpTestingController);
  });

  it('agrega token y empresa a las llamadas a la API', async () => {
    const p = firstValueFrom(http.get('http://api/api/v1/x'));
    await Promise.resolve();
    await Promise.resolve();
    const req = ctrl.expectOne('http://api/api/v1/x');
    expect(req.request.headers.get('Authorization')).toBe('Bearer TOKEN');
    expect(req.request.headers.get('X-Empresa-Id')).toBe('E1');
    req.flush({});
    await p;
  });

  it('no envía el token a otros dominios', () => {
    http.get('https://otro.com/x').subscribe();
    const req = ctrl.expectOne('https://otro.com/x');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });
});
