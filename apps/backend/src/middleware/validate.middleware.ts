import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { ValidationError } from '../utils/errors';

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error: any) {
      const message = error.errors?.map((e: any) => e.message).join(', ') || 'Validation failed';
      throw new ValidationError(message);
    }
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query) as any;
      next();
    } catch (error: any) {
      const message = error.errors?.map((e: any) => e.message).join(', ') || 'Validation failed';
      throw new ValidationError(message);
    }
  };
}
