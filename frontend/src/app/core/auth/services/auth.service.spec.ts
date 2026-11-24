import { TestBed } from '@angular/core/testing';
import { AuthService, nombreDeUsuario } from './auth.service';
import { SupabaseService } from '../../supabase/services/supabase.service';

function crear(signUp: () => Promise<unknown>) {
  TestBed.configureTestingModule({
    providers: [
      {
        provide: SupabaseService,
        useValue: {
          client: {
            auth: {
              getSession: async () => ({ data: { session: null } }),
              onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
              signUp,
            },
          },
        },
      },
    ],
  });
  return TestBed.inject(AuthService);
}

describe('AuthService.registrar', () => {
  it('pide confirmar el correo cuando Supabase no devuelve sesión', async () => {
    const auth = crear(async () => ({ data: { user: { identities: [{}] }, session: null }, error: null }));
    expect(await auth.registrar('Ana', 'ana@x.pe', 'clave1234')).toEqual({ error: null, pendienteConfirmar: true });
  });

  it('detecta correo ya registrado (identities vacías)', async () => {
    const auth = crear(async () => ({ data: { user: { identities: [] }, session: null }, error: null }));
    const r = await auth.registrar('Ana', 'ana@x.pe', 'clave1234');
    expect(r.error).toMatch(/ya tiene una cuenta/);
  });

  it('traduce el límite de intentos', async () => {
    const auth = crear(async () => ({ data: { user: null, session: null }, error: { message: 'email rate limit exceeded' } }));
    const r = await auth.registrar('Ana', 'ana@x.pe', 'clave1234');
    expect(r.error).toMatch(/Demasiados intentos/);
  });
});

describe('nombreDeUsuario (para el saludo)', () => {
  it('usa el nombre que escribió al registrarse', () => {
    expect(nombreDeUsuario({ user_metadata: { nombre: ' José Sánchez ' } })).toBe('José Sánchez');
  });
  it('si entró con Google, usa el nombre de Google', () => {
    expect(nombreDeUsuario({ user_metadata: { full_name: 'Rosa Medina' } })).toBe('Rosa Medina');
    expect(nombreDeUsuario({ user_metadata: { name: 'Luis Torres' } })).toBe('Luis Torres');
  });
  it('sin nombre → vacío', () => {
    expect(nombreDeUsuario({ user_metadata: {} })).toBe('');
    expect(nombreDeUsuario(null)).toBe('');
  });
});
