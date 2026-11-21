import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { getConfig } from '../../config/runtime-config';

/** Cliente de la API NestJS (/api/v1/...). El interceptor pone token y empresa. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${getConfig().apiUrl}/v1`;

  get<T>(ruta: string): Promise<T> {
    return firstValueFrom(this.http.get<T>(`${this.base}${ruta}`));
  }
  post<T>(ruta: string, cuerpo: unknown): Promise<T> {
    return firstValueFrom(this.http.post<T>(`${this.base}${ruta}`, cuerpo));
  }
  patch<T>(ruta: string, cuerpo: unknown): Promise<T> {
    return firstValueFrom(this.http.patch<T>(`${this.base}${ruta}`, cuerpo));
  }
  put<T>(ruta: string, cuerpo: unknown): Promise<T> {
    return firstValueFrom(this.http.put<T>(`${this.base}${ruta}`, cuerpo));
  }
  delete<T>(ruta: string): Promise<T> {
    return firstValueFrom(this.http.delete<T>(`${this.base}${ruta}`));
  }
}
