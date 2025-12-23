import Joi from 'joi';
import { UserRole, MemoryType } from '@prisma/client';

export const schemas = {
  updateUser: Joi.object({
    firstName: Joi.string().optional(),
    lastName: Joi.string().optional(),
    preferredLang: Joi.string().optional(),
  }),

  createWhiteboard: Joi.object({
    title: Joi.string().max(200).required(),
    content: Joi.object().required(),
    isPublic: Joi.boolean().optional(),
  }),

  updateWhiteboard: Joi.object({
    title: Joi.string().max(200).optional(),
    content: Joi.object().optional(),
    isPublic: Joi.boolean().optional(),
  }),

  createMemory: Joi.object({
    type: Joi.string()
      .valid(...Object.values(MemoryType))
      .required(),
    title: Joi.string().required(),
    content: Joi.object().required(),
    metadata: Joi.object().optional(),
  }),

  updateMemory: Joi.object({
    title: Joi.string().optional(),
    content: Joi.object().optional(),
    metadata: Joi.object().optional(),
  }),

  createBookmark: Joi.object({
    type: Joi.string().required(),
    resourceId: Joi.string().required(),
    title: Joi.string().required(),
  }),

  updateSession: Joi.object({
    data: Joi.object().optional(),
    lastPoint: Joi.string().optional(),
  }),
};
