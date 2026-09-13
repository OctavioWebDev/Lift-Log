# Chi-Rho Lifts

**Track Your Progress. Build Real Strength.**

A simple, no-nonsense strength training tracker built for lifters who want to focus on getting stronger, not managing complicated software.

## 🎯 Features

### Core Functionality
- **Workout Logging** - Track sets, reps, weight, and RPE in seconds
- **Goal Setting** - Set strength goals and track progress with visual indicators
- **Dashboard** - View weekly stats, total volume, and recent activity
- **Date Navigation** - Browse and edit workouts from any date
- **Mobile-First Design** - Built for use in the gym on your phone

### User Management
- **Secure Authentication** - Session-based auth with bcrypt password hashing
- **User Accounts** - Private workout data for each user
- **Admin Panel** - Manage users, view system stats, moderate content

### Technical Features
- **Fast & Lightweight** - No heavy frameworks, just what works
- **HTMX-Powered** - Dynamic updates without page reloads
- **SQLite Database** - Simple, reliable data storage
- **Mobile-Responsive** - Works perfectly on all screen sizes

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/OctavioWebDev/Lift-Log.git
cd Lift-Log  # repo slug unchanged; app is now branded Chi-Rho Lifts

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env and add your SESSION_SECRET, JWT_ACCESS_SECRET, and JWT_REFRESH_SECRET

# Initialize database
npm run db:push

# Start development server
npm run dev
```

Visit `http://localhost:3000`

### First-Time Setup

1. Visit the app and create an account
2. Make yourself an admin:
```bash
sqlite3 data/sqlite.db "UPDATE users SET is_admin = 1 WHERE username = 'your_username';"
```
3. Start logging workouts!

## 📁 Project Structure

```
Chi-Rho Lifts/
├── server/
│   ├── index.ts          # Express server setup
│   ├── routes.ts         # All application routes
│   ├── auth.ts           # Authentication middleware
│   ├── storage.ts        # Database operations
│   └── db.ts             # Database connection
├── shared/
│   └── schema.ts         # Database schema (Drizzle ORM)
├── views/
│   ├── landing.ejs       # Marketing landing page
│   ├── login.ejs         # Login page
│   ├── signup.ejs        # Signup page
│   ├── workout-log.ejs   # Main workout logging interface
│   ├── dashboard.ejs     # Stats dashboard
│   ├── goals.ejs         # Goal tracking
│   ├── admin.ejs         # Admin panel
│   └── partials/         # Reusable components
├── data/                 # SQLite database storage
└── package.json
```

## 🛠️ Tech Stack

### Backend
- **Node.js** + **TypeScript** - Type-safe server code
- **Express.js** - Web framework
- **SQLite** - Database
- **Drizzle ORM** - Type-safe database queries
- **bcryptjs** - Password hashing
- **express-session** - Session management

### Frontend
- **EJS** - Server-side templating
- **HTMX** - Dynamic interactions without JavaScript frameworks
- **Tailwind CSS** - Utility-first styling
- **Mobile-First** - Responsive design

## 📊 Database Schema

### Users
- `id` - UUID primary key
- `username` - Unique username
- `email` - Optional email (for recovery)
- `passwordHash` - Bcrypt-hashed password
- `isAdmin` - Admin flag
- `createdAt` - Account creation timestamp

### Workout Sets
- `id` - Auto-incrementing ID
- `exercise` - Exercise name
- `sets` - Number of sets
- `weight` - Weight in lbs
- `reps` - Number of reps
- `rpe` - Optional RPE (Rate of Perceived Exertion)
- `date` - Workout date/time

### Goals
- `id` - Auto-incrementing ID
- `exercise` - Exercise name (unique)
- `current` - Current max weight
- `target` - Target weight goal
- `unit` - Weight unit (default: lbs)

## 🔒 Security Features

- **Password Hashing** - bcrypt with 10 rounds
- **Session Management** - HTTP-only cookies, 7-day expiration
- **Input Validation** - Server-side validation on all inputs
- **Admin Protection** - Admin routes require authentication + admin flag
- **HTTPS Ready** - Secure flag enabled in production

## 🌐 Routes

### Public Routes
- `GET /` - Landing page (redirects to `/app` if logged in)
- `GET /login` - Login page
- `POST /login` - Login handler
- `GET /signup` - Signup page
- `POST /signup` - Signup handler
- `POST /logout` - Logout handler

### Protected Routes (Require Authentication)
- `GET /app` - Workout log
- `GET /dashboard` - Stats dashboard
- `GET /goals` - Goal tracking
- `GET /admin` - Admin panel (admins only)

### API Routes
- `GET /api/workout-sets` - Get workouts for date
- `POST /api/workout-sets` - Create workout
- `PUT /api/workout-sets/:id` - Update workout
- `DELETE /api/workout-sets/:id` - Delete workout
- `GET /api/goals` - Get all goals
- `POST /api/goals` - Create goal
- `PATCH /api/goals/:exercise` - Update goal
- `DELETE /api/goals/:id` - Delete goal

### Mobile JSON API (`/api/v1`)

A separate, versioned, JWT-authenticated JSON API for the upcoming mobile app. It reuses the same
storage layer and Zod schemas as the web app, but never redirects or renders HTML — every response
is JSON, and auth is via `Authorization: Bearer <accessToken>` instead of cookies.

- `POST /api/v1/auth/signup` - Create account, returns `{ user, accessToken, refreshToken }`
- `POST /api/v1/auth/login` - Returns `{ user, accessToken, refreshToken }`
- `POST /api/v1/auth/refresh` - Exchange a refresh token for a new pair (rotates the old one out)
- `POST /api/v1/auth/logout` - Revokes a refresh token
- `GET /api/v1/auth/me` - Current user + subscription status (requires access token)
- `GET /api/v1/billing/status` - Subscription status/interval/period end
- `GET /api/v1/workout-sets` / `GET /api/v1/workout-sets/all` - List workouts
- `POST /api/v1/workout-sets` / `PUT /api/v1/workout-sets/:id` / `DELETE /api/v1/workout-sets/:id`
- `GET /api/v1/goals` / `POST /api/v1/goals` / `PATCH /api/v1/goals/:exercise` / `DELETE /api/v1/goals/:id`
- `GET /api/v1/nutrition` / `POST /api/v1/nutrition` / `DELETE /api/v1/nutrition/:id`
- `POST /api/v1/nutrition/goals`
- `GET /api/v1/food/search?q=...`

All `/api/v1` data routes (workouts, goals, nutrition) require an active subscription and respond
`402` if one isn't present, so the mobile app can distinguish "not logged in" (`401`) from
"logged in but needs to subscribe" (`402`).

Access tokens are short-lived (15 minutes); refresh tokens are long-lived (30 days) and rotate on
every use — each refresh token is single-use and tracked server-side in the `refresh_tokens` table
so a specific device/session can be revoked without invalidating everyone else's.

## 🎨 Design Philosophy

**No BS. Just Strength.**

The fitness industry thrives on complexity. We believe in simplicity:
- Track workouts
- Set goals
- Get stronger

No supplement pitches. No unnecessary features. No dependency-creating complexity.

## 🚢 Deployment

### Environment Variables

```env
PORT=3000
SESSION_SECRET=your-secret-key-change-this
JWT_ACCESS_SECRET=your-access-token-secret
JWT_REFRESH_SECRET=your-refresh-token-secret
NODE_ENV=production
```

See `.env.example` for the full list, including Stripe and USDA keys.

### Deploy to Render/Railway/Fly.io

1. Push code to GitHub
2. Connect repository to hosting platform
3. Set environment variables
4. Deploy!

Database will be created automatically on first run.

## 📝 Development

### Available Scripts

```bash
npm run dev          # Start development server with hot reload
npm run build        # Build for production
npm run start        # Start production server
npm run db:push      # Push schema changes to database
npm run db:studio    # Open Drizzle Studio (database GUI)
```

### Making Schema Changes

1. Edit `shared/schema.ts`
2. Run `npm run db:push`
3. Schema changes applied to database

### Creating Admin Users

```bash
# Make existing user an admin
sqlite3 data/sqlite.db "UPDATE users SET is_admin = 1 WHERE username = 'username';"

# Check admin status
sqlite3 data/sqlite.db "SELECT username, is_admin FROM users;"
```

## 🤝 Contributing

This is a personal project, but feedback and suggestions are welcome!

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License - See [LICENSE](LICENSE) for details

## 👤 Author

**Octavio Sanchez**
- Website: [chirhostrength.com](https://chirhostrength.com)
- GitHub: [@OctavioWebDev](https://github.com/OctavioWebDev)
- Email: chirhostrength@gmail.com

## 🙏 Acknowledgments

Built with:
- [Express.js](https://expressjs.com/)
- [HTMX](https://htmx.org/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Tailwind CSS](https://tailwindcss.com/)

---

**Built by a lifter, for lifters.**

Track your progress. Build real strength. No BS.
