# Strength Log

A digital notebook for tracking your strength training journey. Built with React, Express, and SQLite.

## Features

- 📝 **Daily Log**: Track your workout sets with exercise, weight, reps, and sets
- 📊 **Dashboard**: View your training progress with charts and statistics
- 🎯 **Yearly Goals**: Set and track your strength goals for 2025
- 📈 **Progress Tracking**: Monitor volume, max weights, and personal records

## Tech Stack

- **Frontend**: React, Tailwind CSS, Framer Motion, Recharts
- **Backend**: Express.js, Drizzle ORM
- **Database**: SQLite (better-sqlite3)
- **Form Handling**: React Hook Form with Zod validation

## Getting Started

### Prerequisites

- Node.js 18+ (with npm)
- Git

### Installation

1. Clone the repository
```bash
git clone <your-repo-url>
cd strength-log
```

2. Install dependencies
```bash
npm install
```

3. Initialize the database
```bash
npm run db:init
```

4. (Optional) Seed with sample data
```bash
npm run db:seed
```

5. Start the development server
```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## Database Scripts

- `npm run db:init` - Initialize the database with tables
- `npm run db:seed` - Add sample workout and goal data
- `npm run db:migrate` - Run Drizzle migrations (alternative)
- `npm run db:push` - Push schema changes to database
- `npm run db:studio` - Open Drizzle Studio to view database

## Project Structure

```
strength-log/
├── client/               # React frontend
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── pages/       # Page components (Home, Dashboard, Goals)
│   │   ├── hooks/       # Custom React hooks
│   │   └── lib/         # Utilities and query client
│   └── index.html
├── server/              # Express backend
│   ├── db.ts           # Database connection
│   ├── routes.ts       # API endpoints
│   ├── storage.ts      # Database operations
│   └── index.ts        # Server entry point
├── shared/             # Shared code
│   └── schema.ts       # Database schema and types
├── drizzle/            # Database migrations
├── data/               # SQLite database files
└── package.json
```

## API Endpoints

### Workout Sets
- `GET /api/workout-sets?date=YYYY-MM-DD` - Get workout sets for a date
- `GET /api/workout-sets-all` - Get all workout sets
- `POST /api/workout-sets` - Create a new workout set
- `PUT /api/workout-sets/:id` - Update a workout set
- `DELETE /api/workout-sets/:id` - Delete a workout set

### Goals
- `GET /api/goals` - Get all goals
- `POST /api/goals` - Create a new goal
- `PATCH /api/goals/:exercise` - Update a goal by exercise name
- `DELETE /api/goals/:id` - Delete a goal

## Database Schema

### workout_sets
- `id` - Auto-incrementing primary key
- `exercise` - Exercise name (text)
- `sets` - Number of sets (integer, default 1)
- `weight` - Weight used in lbs (integer)
- `reps` - Reps per set (integer)
- `rpe` - Rate of perceived exertion (real, optional)
- `date` - Timestamp of the workout

### goals
- `id` - Auto-incrementing primary key
- `exercise` - Exercise name (text, unique)
- `current` - Current weight/max (integer)
- `target` - Target weight/max (integer)
- `unit` - Unit of measurement (text, default 'lbs')

## Building for Production

```bash
npm run build
npm start
```

The build script will:
1. Build the React frontend with Vite
2. Bundle the Express server with esbuild
3. Output everything to the `dist/` directory

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.