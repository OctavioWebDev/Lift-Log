import { db } from "./server/db";
import { workoutSets, goals } from "./shared/schema";

async function seed() {
  
  try {
    // Add sample workout sets
    const sampleWorkouts = [
      {
        exercise: "Squat",
        sets: 3,
        weight: 225,
        reps: 5,
        date: new Date(),
      },
      {
        exercise: "Bench Press",
        sets: 3,
        weight: 185,
        reps: 5,
        date: new Date(),
      },
      {
        exercise: "Deadlift",
        sets: 1,
        weight: 315,
        reps: 5,
        date: new Date(),
      },
    ];

    for (const workout of sampleWorkouts) {
      await db.insert(workoutSets).values(workout);
    }

    // Add sample goals
    const sampleGoals = [
      {
        exercise: "Squat",
        current: 225,
        target: 315,
        unit: "lbs",
      },
      {
        exercise: "Bench Press",
        current: 185,
        target: 225,
        unit: "lbs",
      },
      {
        exercise: "Deadlift",
        current: 315,
        target: 405,
        unit: "lbs",
      },
    ];

    for (const goal of sampleGoals) {
      await db.insert(goals).values(goal);
    }
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

seed();