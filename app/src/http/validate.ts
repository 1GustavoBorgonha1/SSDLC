/** Ponte entre zod e o formato de erro de SPEC-002 §1. */
import type { z, ZodTypeAny } from 'zod';
import { AppError } from './errors.ts';

export function validate<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues.map((issue) => {
      const path = issue.path.join('.');
      return path === '' ? issue.message : `${path}: ${issue.message}`;
    });
    throw new AppError('VALIDATION_ERROR', 'Dados da requisição inválidos.', details);
  }
  return result.data;
}
