import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "@shared/schema";

const databaseUrl = process.env.DATABASE_URL || 'file:./data/sqlite.db';
const sqlite = new Database(databaseUrl.replace('file:', ''));
export const db = drizzle(sqlite, { schema });