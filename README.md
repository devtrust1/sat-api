# SAT Project - Backend API

A comprehensive TypeScript-based backend API for the SAT educational platform, featuring:

- 🔐 **Secure Authentication** with Clerk
- 🌍 **Multi-language Support** (English, Spanish, Chinese, Hindi)
- 🎨 **Interactive Whiteboard** system with AI-driven solutions
- 🧠 **Memory System** for personalized learning
- 📚 **Bookmark Management** for lessons and resources
- 🤖 **AI Integration** for intelligent tutoring

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express 5.x
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Clerk
- **Internationalization**: i18next
- **Validation**: Joi
- **Logging**: Winston
- **Security**: Helmet, CORS, Rate Limiting

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+ (or use Docker)
- Clerk account for authentication

### Installation

```bash
# 1. Clone and install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# 3. Start PostgreSQL (using Docker)
docker-compose up -d postgres

# 4. Generate Prisma Client and run migrations
npm run prisma:generate
npm run prisma:migrate

# 5. Start development server
npm run dev
```

The API will be available at `http://localhost:5000`

## Project Structure

```
src/
├── config/          # Configuration files
├── types/           # TypeScript definitions
├── utils/           # Utility functions
├── middleware/      # Express middleware
├── services/        # Business logic
├── controllers/     # Route handlers
├── routes/          # API routes
├── locales/         # Translation files
└── server.ts        # Application entry point
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build TypeScript to JavaScript |
| `npm start` | Start production server |
| `npm run prisma:generate` | Generate Prisma Client |
| `npm run prisma:migrate` | Run database migrations |
| `npm run prisma:studio` | Open Prisma Studio GUI |
| `npm run db:push` | Push schema changes without migration |
| `npm test` | Run tests |
| `npm run lint` | Lint code |
| `npm run format` | Format code with Prettier |

## API Endpoints

See [SETUP.md](./SETUP.md) for complete API documentation.

Base URL: `http://localhost:5000/api/v1`

### Main Resources

- `/auth` - Authentication endpoints
- `/users` - User management
- `/whiteboards` - Whiteboard CRUD operations
- `/memory` - Memory and session management
- `/bookmarks` - Bookmark management
- `/translations` - Translation services

## Database Schema

The application uses Prisma ORM with the following main models:

- **User** - User profiles with role-based access
- **Session** - User sessions with auto-save
- **Whiteboard** - Interactive whiteboards with AI solutions
- **Memory** - User progress and preferences
- **Bookmark** - Bookmarked resources

## Features

### 🔐 Authentication & Security
- Clerk integration for secure authentication
- Role-based access control (Student, Tutor, Admin)
- Session management with automatic timeout
- Rate limiting and security headers

### 🌍 Multi-Language Support
- Dynamic language switching
- Translations for UI and AI responses
- Fallback handling for missing translations
- Support for: English, Spanish, Chinese, Hindi

### 🎨 Whiteboard System
- Create and manage interactive whiteboards
- AI-driven step-by-step solutions
- Animated problem-solving with playback controls
- Public/private whiteboard sharing

### 🧠 Memory Feature
- Track user progress and learning history
- Auto-save sessions
- Resume from last point
- Personalized AI responses based on user data
- Bookmark lessons, chats, and whiteboards

## Development

### Database Management

```bash
# View database in Prisma Studio
npm run prisma:studio

# Create a new migration
npm run prisma:migrate

# Reset database (careful!)
npx prisma migrate reset
```

### Code Quality

```bash
# Lint code
npm run lint

# Format code
npm run format

# Run tests
npm test
```

## Deployment

### Building for Production

```bash
# Build TypeScript
npm run build

# Start production server
npm start
```

### Environment Variables

Ensure all required environment variables are set in production:

- `DATABASE_URL` - PostgreSQL connection string
- `CLERK_PUBLISHABLE_KEY` - Clerk publishable key
- `CLERK_SECRET_KEY` - Clerk secret key
- `PORT` - Server port (default: 5000)
- `NODE_ENV` - Set to 'production'
- `CORS_ORIGIN` - Frontend URL

## Integration with Next.js Frontend

This backend is designed to work seamlessly with a Next.js frontend:

1. Use Clerk for authentication on both sides
2. Pass auth tokens with API requests
3. Use the same language codes for i18n
4. Handle standardized API responses

Example Next.js API call:

```typescript
const response = await fetch('http://localhost:5000/api/v1/users/me', {
  headers: {
    'Authorization': `Bearer ${await getToken()}`,
    'Accept-Language': locale,
  },
});
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

ISC

## Support

For issues and questions, please open an issue on GitHub or contact the development team.