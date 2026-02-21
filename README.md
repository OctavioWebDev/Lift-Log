# Lift-Log

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
cd Lift-Log

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env and add your SESSION_SECRET

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
Lift-Log/
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
NODE_ENV=production
```

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
