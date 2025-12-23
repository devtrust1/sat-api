import { Response, NextFunction } from 'express';
import Joi from 'joi';
import { AuthRequest } from '../types';

export const validate = (
  schema: Joi.ObjectSchema,
  source: 'body' | 'query' | 'params' = 'body'
) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req[source], { abortEarly: false });

    if (error) {
      const errors = error.details.map(d => ({ field: d.path.join('.'), message: d.message }));
      return res.status(422).json({ success: false, message: 'Validation error', errors });
    }

    req[source] = value;
    next();
  };
};
