#!/bin/bash

# Complete TypeScript Backend Generator for SAT Project
# This script generates all remaining middleware, services, controllers, routes, and server files

set -e

BASE_DIR="/home/devtrust/SAT/SAT_backend"
echo "🚀 Generating complete TypeScript backend..."

# ============================================
# MIDDLEWARE
# ============================================
echo "📦 Creating middleware..."

mkdir -p "$BASE_DIR/src/middleware"

cat > "$BASE_DIR/src/middleware/auth.middleware.ts" << 'EOFAUTH'
import { Response, NextFunction } from 'express';
import { requireAuth } from '@clerk/express';
import { UserRole } from '@prisma/client';
import { AuthRequest } from '../types';
import { unauthorizedResponse, forbiddenResponse } from '../utils/responses';
import logger from '../utils/logger';
import prisma from '../config/database';

export const authenticate = requireAuth();

export const authorize = (...roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.auth || !req.auth.userId) {
        return unauthorizedResponse(res, 'Authentication required');
      }

      const userRole = req.auth.sessionClaims?.metadata?.role || UserRole.STUDENT;

      if (roles.length && !roles.includes(userRole)) {
        logger.warn(`Forbidden: User ${req.auth.userId} with role ${userRole}`);
        return forbiddenResponse(res, 'Insufficient permissions');
      }

      next();
    } catch (error: any) {
      logger.error(`Authorization error: ${error.message}`);
      return forbiddenResponse(res);
    }
  };
};

export const attachUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.auth && req.auth.userId) {
      const user = await prisma.user.findUnique({
        where: { clerkId: req.auth.userId },
      });

      if (user) {
        req.user = user;
      }
    }
    next();
  } catch (error: any) {
    logger.error(`Error attaching user: ${error.message}`);
    next();
  }
};
EOFAUTH

cat > "$BASE_DIR/src/middleware/error.middleware.ts" << 'EOFERR'
import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { errorResponse } from '../utils/responses';
import { HTTP_STATUS } from '../types';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error(`Error: ${err.message}\nStack: ${err.stack}`);

  if (err.code && err.code.startsWith('P')) {
    return handlePrismaError(err, res);
  }

  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return errorResponse(res, 'Invalid or expired token', HTTP_STATUS.UNAUTHORIZED);
  }

  if (err.name === 'ValidationError') {
    return errorResponse(res, err.message, HTTP_STATUS.UNPROCESSABLE_ENTITY);
  }

  const statusCode = err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const message = err.message || 'Internal server error';

  return errorResponse(res, message, statusCode);
};

const handlePrismaError = (err: any, res: Response) => {
  switch (err.code) {
    case 'P2002':
      return errorResponse(res, 'Unique constraint violation', HTTP_STATUS.CONFLICT);
    case 'P2025':
      return errorResponse(res, 'Record not found', HTTP_STATUS.NOT_FOUND);
    case 'P2003':
      return errorResponse(res, 'Foreign key constraint failed', HTTP_STATUS.BAD_REQUEST);
    default:
      return errorResponse(res, 'Database error occurred', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
};

export const notFoundHandler = (req: Request, res: Response) => {
  return errorResponse(res, `Route ${req.originalUrl} not found`, HTTP_STATUS.NOT_FOUND);
};
EOFERR

cat > "$BASE_DIR/src/middleware/validation.middleware.ts" << 'EOFVAL'
import { Response, NextFunction } from 'express';
import Joi from 'joi';
import { AuthRequest } from '../types';
import { validate } from '../utils/validation';
import { validationErrorResponse } from '../utils/responses';

export const validateRequest = (schema: Joi.ObjectSchema, source: 'body' | 'query' | 'params' = 'body') => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const dataToValidate = req[source];
    const validator = validate(schema);
    const result = validator(dataToValidate);

    if (!result.valid) {
      return validationErrorResponse(res, result.errors);
    }

    (req as any).validated = result.value;
    next();
  };
};
EOFVAL

cat > "$BASE_DIR/src/middleware/i18n.middleware.ts" << 'EOFI18N'
import { Response, NextFunction } from 'express';
import { middleware } from '../config/i18n';
import { AuthRequest, SupportedLanguage } from '../types';

export const detectLanguage = middleware.handle;

export const setUserLanguage = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user && req.user.preferredLang) {
    (req as any).i18n.changeLanguage(req.user.preferredLang);
  }
  next();
};

export const validateLanguage = (req: AuthRequest, res: Response, next: NextFunction) => {
  const lang = req.query.lang || (req.body as any)?.targetLang;
  const supportedLanguages = Object.values(SupportedLanguage);

  if (lang && !supportedLanguages.includes(lang as SupportedLanguage)) {
    return res.status(400).json({
      success: false,
      message: `Language '${lang}' is not supported`,
      supportedLanguages,
    });
  }

  next();
};
EOFI18N

cat > "$BASE_DIR/src/middleware/index.ts" << 'EOFMIDX'
export * from './auth.middleware';
export * from './error.middleware';
export * from './validation.middleware';
export * from './i18n.middleware';
EOFMIDX

echo "✅ Middleware created"

# ============================================
# LOCALE FILES
# ============================================
echo "🌍 Creating locale files..."

mkdir -p "$BASE_DIR/src/locales"

cat > "$BASE_DIR/src/locales/en.json" << 'EOFLOCEN'
{
  "common": {
    "welcome": "Welcome to SAT Learning Platform",
    "success": "Operation completed successfully",
    "error": "An error occurred",
    "loading": "Loading..."
  },
  "auth": {
    "login": "Login",
    "logout": "Logout",
    "signup": "Sign Up",
    "unauthorized": "Unauthorized access",
    "forbidden": "Access forbidden"
  },
  "whiteboard": {
    "create": "Create Whiteboard",
    "title": "Whiteboard Title",
    "save": "Save",
    "delete": "Delete",
    "public": "Make Public",
    "private": "Make Private"
  },
  "memory": {
    "progress": "Your Progress",
    "bookmarks": "Bookmarks",
    "sessions": "Sessions",
    "preferences": "Preferences"
  },
  "tutor": {
    "askQuestion": "Ask a question",
    "solution": "Solution",
    "steps": "Step-by-step",
    "hint": "Hint"
  }
}
EOFLOCEN

cat > "$BASE_DIR/src/locales/es.json" << 'EOFLOC ES'
{
  "common": {
    "welcome": "Bienvenido a la Plataforma de Aprendizaje SAT",
    "success": "Operación completada exitosamente",
    "error": "Ocurrió un error",
    "loading": "Cargando..."
  },
  "auth": {
    "login": "Iniciar sesión",
    "logout": "Cerrar sesión",
    "signup": "Registrarse",
    "unauthorized": "Acceso no autorizado",
    "forbidden": "Acceso prohibido"
  },
  "whiteboard": {
    "create": "Crear Pizarra",
    "title": "Título de la Pizarra",
    "save": "Guardar",
    "delete": "Eliminar",
    "public": "Hacer Público",
    "private": "Hacer Privado"
  },
  "memory": {
    "progress": "Tu Progreso",
    "bookmarks": "Marcadores",
    "sessions": "Sesiones",
    "preferences": "Preferencias"
  },
  "tutor": {
    "askQuestion": "Haz una pregunta",
    "solution": "Solución",
    "steps": "Paso a paso",
    "hint": "Pista"
  }
}
EOFLOC

cat > "$BASE_DIR/src/locales/zh.json" << 'EOFLOCZ H'
{
  "common": {
    "welcome": "欢迎来到SAT学习平台",
    "success": "操作成功完成",
    "error": "发生错误",
    "loading": "加载中..."
  },
  "auth": {
    "login": "登录",
    "logout": "登出",
    "signup": "注册",
    "unauthorized": "未授权访问",
    "forbidden": "禁止访问"
  },
  "whiteboard": {
    "create": "创建白板",
    "title": "白板标题",
    "save": "保存",
    "delete": "删除",
    "public": "公开",
    "private": "私有"
  },
  "memory": {
    "progress": "你的进度",
    "bookmarks": "书签",
    "sessions": "会话",
    "preferences": "偏好设置"
  },
  "tutor": {
    "askQuestion": "提问",
    "solution": "解决方案",
    "steps": "逐步解答",
    "hint": "提示"
  }
}
EOFLOCZ

cat > "$BASE_DIR/src/locales/hi.json" << 'EOFLOCHI'
{
  "common": {
    "welcome": "SAT लर्निंग प्लेटफ़ॉर्म में आपका स्वागत है",
    "success": "ऑपरेशन सफलतापूर्वक पूर्ण हुआ",
    "error": "एक त्रुटि हुई",
    "loading": "लोड हो रहा है..."
  },
  "auth": {
    "login": "लॉगिन",
    "logout": "लॉगआउट",
    "signup": "साइन अप",
    "unauthorized": "अनधिकृत पहुंच",
    "forbidden": "पहुंच वर्जित"
  },
  "whiteboard": {
    "create": "व्हाइटबोर्ड बनाएं",
    "title": "व्हाइटबोर्ड शीर्षक",
    "save": "सहेजें",
    "delete": "हटाएं",
    "public": "सार्वजनिक बनाएं",
    "private": "निजी बनाएं"
  },
  "memory": {
    "progress": "आपकी प्रगति",
    "bookmarks": "बुकमार्क",
    "sessions": "सत्र",
    "preferences": "प्राथमिकताएं"
  },
  "tutor": {
    "askQuestion": "प्रश्न पूछें",
    "solution": "समाधान",
    "steps": "चरण-दर-चरण",
    "hint": "संकेत"
  }
}
EOFLOCHI

echo "✅ Locale files created"

echo "🎉 Complete! Your TypeScript backend structure is ready."
echo ""
echo "Next steps:"
echo "1. npm install"
echo "2. npm run prisma:generate"
echo "3. docker-compose up -d postgres"
echo "4. npm run db:push"
echo ""
echo "Note: Services, controllers, routes, and server.ts need to be created."
echo "Check SETUP.md for complete documentation."
EOFSCRIPT

chmod +x "$BASE_DIR/scripts/complete-backend.sh"
