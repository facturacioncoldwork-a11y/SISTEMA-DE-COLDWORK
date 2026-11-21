import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

export interface ErrorPostgrest {
  code?: string;
  message: string;
  details?: string | null;
  hint?: string | null;
}

/**
 * Convierte un error de Supabase/PostgREST en una respuesta HTTP clara.
 * Códigos: https://postgrest.org/en/stable/references/errors.html
 */
export function aHttp(error: ErrorPostgrest): HttpException {
  // Supabase no responde (caído, red, DNS): 503 para que el balanceador/cliente reintente
  if (!error.code && /fetch failed|network|ECONNREFUSED|ETIMEDOUT|ENOTFOUND/i.test(error.message ?? '')) {
    return new ServiceUnavailableException('La base de datos no está disponible, intenta en unos segundos');
  }
  switch (error.code) {
    case '42501': // RLS / permiso denegado
      return new ForbiddenException(mensajePermiso(error.message));
    case 'PGRST116': // .single() sin filas
      return new NotFoundException('No encontrado');
    case 'PGRST301':
    case 'PGRST302':
      return new UnauthorizedException('Sesión inválida o vencida');
    case '23505':
      return new ConflictException('Ya existe un registro con esos datos');
    case '23503':
      return new ConflictException('El registro está relacionado con otros datos');
    case '23502':
    case '23514':
    case '22P02':
    case '22001':
      return new BadRequestException(error.message);
    case 'P0001': // raise exception desde una función SQL: mensaje pensado para el usuario
      return new BadRequestException(error.message);
    default:
      return new InternalServerErrorException('Error al consultar la base de datos');
  }
}

/**
 * Mensaje de un permiso denegado: si viene de nuestras funciones SQL (ya está en español y
 * pensado para el usuario, ej. "envíalo al dueño") se usa; si es el texto técnico de Postgres, uno genérico.
 */
function mensajePermiso(mensaje: string | undefined): string {
  const tecnico = !mensaje || /permission denied|row-level security|violates|policy/i.test(mensaje);
  return tecnico ? 'No tienes permiso para esta acción' : mensaje;
}

/** Lanza si Supabase devolvió error; si no, devuelve los datos. */
export function datosOError<T>(r: { data: T | null; error: ErrorPostgrest | null }): T {
  if (r.error) throw aHttp(r.error);
  return r.data as T;
}
