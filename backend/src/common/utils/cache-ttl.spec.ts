import { describe, expect, it } from 'vitest';
import { CacheTtl } from './cache-ttl.js';

describe('CacheTtl', () => {
  it('devuelve el valor mientras no vence y lo olvida al vencer', () => {
    let reloj = 0;
    const cache = new CacheTtl<string>(1000, 10, () => reloj);
    cache.guardar('a', 'uno');
    reloj = 999;
    expect(cache.obtener('a')).toBe('uno');
    reloj = 1000;
    expect(cache.obtener('a')).toBeUndefined();
  });

  it('no pasa del máximo: descarta la entrada más antigua', () => {
    const cache = new CacheTtl<number>(60_000, 2);
    cache.guardar('a', 1);
    cache.guardar('b', 2);
    cache.guardar('c', 3);
    expect(cache.tamano).toBe(2);
    expect(cache.obtener('a')).toBeUndefined();
    expect(cache.obtener('c')).toBe(3);
  });

  it('olvida por prefijo', () => {
    const cache = new CacheTtl<number>(60_000);
    cache.guardar('usuario1:empresaA', 1);
    cache.guardar('usuario1:empresaB', 2);
    cache.guardar('usuario2:empresaA', 3);
    cache.olvidar('usuario1:');
    expect(cache.tamano).toBe(1);
  });
});
