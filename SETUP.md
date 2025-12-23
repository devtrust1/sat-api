# SAT Backend - TypeScript Setup Guide

## Project Structure (Complete)

```
SAT_backend/
├── src/
│   ├── config/          ✅ Configuration files
│   ├── types/           ✅ TypeScript type definitions
│   ├── utils/           ✅ Utility functions
│   ├── middleware/      ⏳ Auth, validation, error handling
│   ├── services/        ⏳ Business logic layer
│   ├── controllers/     ⏳ Route handlers
│   ├── routes/          ⏳ API routes
│   ├── locales/         ⏳ Translation files
│   └── server.ts        ⏳ Entry point
├── prisma/
│   └── schema.prisma    ✅ Database schema
├── config/              (moved to src/config)
├── logs/                Auto-generated
├── dist/                Auto-generated (build output)
└── tests/               ⏳ Test files
```

## What's Been Created

### ✅ Completed:
1. **package.json** - Updated with TypeScript dependencies and scripts
2. **tsconfig.json** - TypeScript configuration
3. **nodemon.json** - Development server config
4. **.prettierrc** - Code formatting
5. **.eslintrc.json** - Code linting
6. **src/types/index.ts** - All TypeScript interfaces and types
7. **src/config/** - Database, app, and i18n configuration
8. **src/utils/** - Logger, helpers, responses, validation

### ⏳ To Be Created:
- Middleware (auth, i18n, validation, error)
- Services (user, whiteboard, memory, AI, translation)
- Controllers (API handlers)
- Routes (API endpoints)
- Server entry point
- Locale files
- Docker setup

## Installation Steps

```bash
# 1. Install all dependencies
npm install

# 2. Generate Prisma Client
npm run prisma:generate

# 3. Push database schema (or run migrations)
npm run db:push
# OR
npm run prisma:migrate

# 4. Start development server
npm run dev

# 5. For production
npm run build
npm start
```

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm run prisma:generate` - Generate Prisma Client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:studio` - Open Prisma Studio
- `npm run test` - Run tests
- `npm run lint` - Lint code
- `npm run format` - Format code with Prettier

## Environment Variables

Create a `.env` file with:

```env
# Database
DATABASE_URL="postgresql://postgres:admin@localhost:5432/sat_db?schema=public"

# Server
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

# Clerk Auth
CLERK_PUBLISHABLE_KEY=your_key_here
CLERK_SECRET_KEY=your_secret_here

# Session
SESSION_TIMEOUT_MINUTES=30
MAX_CONCURRENT_SESSIONS=5

# AI Service (Optional)
AI_PROVIDER=openai
AI_API_KEY=your_ai_api_key
AI_MODEL=gpt-4

# Logging
LOG_LEVEL=info
```

## API Endpoints (To Be Implemented)

### Auth
- POST `/api/v1/auth/webhook` - Clerk webhook

### Users
- GET `/api/v1/users/me` - Get current user
- PUT `/api/v1/users/me` - Update current user
- GET `/api/v1/users/me/preferences` - Get user preferences
- PUT `/api/v1/users/me/preferences` - Update preferences

### Whiteboards
- GET `/api/v1/whiteboards` - List user whiteboards
- POST `/api/v1/whiteboards` - Create whiteboard
- GET `/api/v1/whiteboards/:id` - Get whiteboard
- PUT `/api/v1/whiteboards/:id` - Update whiteboard
- DELETE `/api/v1/whiteboards/:id` - Delete whiteboard
- GET `/api/v1/whiteboards/public` - List public whiteboards

### Memory & Sessions
- GET `/api/v1/memory/:type` - Get memories by type
- POST `/api/v1/memory` - Create memory
- PUT `/api/v1/memory/:id` - Update memory
- DELETE `/api/v1/memory/:id` - Delete memory
- POST `/api/v1/sessions` - Save session
- GET `/api/v1/sessions/last` - Get last session

### Bookmarks
- GET `/api/v1/bookmarks` - List bookmarks
- POST `/api/v1/bookmarks` - Create bookmark
- DELETE `/api/v1/bookmarks/:id` - Delete bookmark

### Translations
- POST `/api/v1/translations` - Translate text
- GET `/api/v1/translations/:lang` - Get language bundle

## Next Steps

1. Complete middleware implementation
2. Implement all services
3. Create controllers
4. Set up routes
5. Create server.ts entry point
6. Add translation files
7. Set up Docker
8. Write tests

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express 5
- **Database**: PostgreSQL with Prisma ORM
- **Auth**: Clerk
- **i18n**: i18next
- **Logging**: Winston
- **Validation**: Joi
- **Security**: Helmet, CORS, Rate Limiting

## For Next.js Frontend Integration

Your Next.js frontend should:
1. Use Clerk for authentication
2. Call these API endpoints with auth tokens
3. Use the same language codes (en, es, zh, hi)
4. Handle API responses in the format:
   ```typescript
   {
     success: boolean;
     message: string;
     data?: any;
     errors?: any;
   }
   ```
