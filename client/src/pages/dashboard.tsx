import { useMemo } from "react";
import Layout from "@/components/layout";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { motion } from "framer-motion";
import type { WorkoutSet, Goal } from "@shared/schema";

export default function Dashboard() {
  const { data: workoutSets = [], isLoading: setsLoading } = useQuery<WorkoutSet[]>({
    queryKey: ['/api/workout-sets-all'],
    queryFn: async () => {
      const response = await fetch('/api/workout-sets-all');
      if (!response.ok) throw new Error('Failed to fetch workout sets');
      return response.json();
    },
  });

  const { data: goals = [], isLoading: goalsLoading } = useQuery<Goal[]>({
    queryKey: ['/api/goals'],
    queryFn: async () => {
      const response = await fetch('/api/goals');
      if (!response.ok) throw new Error('Failed to fetch goals');
      return response.json();
    },
  });

  const stats = useMemo(() => {
    if (!workoutSets.length) return null;

    // Total volume
    const totalVolume = workoutSets.reduce((sum, set) => sum + (set.sets * set.weight * set.reps), 0);

    // Exercise frequency and stats
    const exerciseStats: Record<string, { count: number; volume: number; maxWeight: number; totalReps: number }> = {};
    
    workoutSets.forEach(set => {
      if (!exerciseStats[set.exercise]) {
        exerciseStats[set.exercise] = { count: 0, volume: 0, maxWeight: 0, totalReps: 0 };
      }
      exerciseStats[set.exercise].count += 1;
      exerciseStats[set.exercise].volume += set.sets * set.weight * set.reps;
      exerciseStats[set.exercise].maxWeight = Math.max(exerciseStats[set.exercise].maxWeight, set.weight);
      exerciseStats[set.exercise].totalReps += set.reps;
    });

    const exerciseList = Object.entries(exerciseStats)
      .map(([exercise, data]) => ({
        name: exercise,
        workouts: data.count,
        volume: data.volume,
        maxWeight: data.maxWeight,
      }))
      .sort((a, b) => b.workouts - a.workouts);

    const topExercises = exerciseList.slice(0, 5);
    const volumeByExercise = exerciseList.map(e => ({ name: e.name, volume: e.volume }));

    return {
      totalVolume,
      totalWorkouts: workoutSets.length,
      exerciseList,
      topExercises,
      volumeByExercise,
    };
  }, [workoutSets]);

  const isLoading = setsLoading || goalsLoading;

  if (isLoading) {
    return (
      <Layout>
        <div className="p-8 text-center font-hand text-2xl text-muted-foreground/50">
          Loading...
        </div>
      </Layout>
    );
  }

  if (!stats) {
    return (
      <Layout>
        <div className="p-8 text-center font-hand text-2xl text-muted-foreground/50 border-2 border-dashed border-muted-foreground/20 rounded-lg">
          No workout data yet. Start logging sets to see your progress!
        </div>
      </Layout>
    );
  }

  const COLORS = ['#ea580c', '#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6'];

  return (
    <Layout>
      <div className="space-y-12">
        <div>
          <h2 className="font-hand text-3xl text-primary mb-2">Your Progress</h2>
          <p className="font-mono text-muted-foreground text-sm">Training statistics and insights</p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border-2 border-border p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] rotate-[0.5deg]"
            data-testid="stat-total-workouts"
          >
            <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-2">Total Workouts</p>
            <p className="font-hand text-4xl font-bold text-primary">{stats.totalWorkouts}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card border-2 border-border p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] rotate-[0.5deg]"
            data-testid="stat-total-volume"
          >
            <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-2">Total Volume</p>
            <p className="font-hand text-3xl font-bold text-accent">{(stats.totalVolume / 1000).toFixed(1)}k lbs</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-card border-2 border-border p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] rotate-[0.5deg]"
            data-testid="stat-exercises"
          >
            <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-2">Exercises Tracked</p>
            <p className="font-hand text-4xl font-bold text-primary">{stats.exerciseList.length}</p>
          </motion.div>
        </div>

        {/* Top Exercises */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-white border-2 border-border p-6 rounded-lg"
        >
          <h3 className="font-hand text-2xl font-bold text-primary mb-6">Most Trained Exercises</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats.topExercises}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="workouts" fill="#ea580c" name="Workouts" />
              <Bar dataKey="maxWeight" fill="#0ea5e9" name="Max Weight (lbs)" />
            </BarChart>
          </ResponsiveContainer>
        </motion.section>

        {/* Volume Distribution */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-white border-2 border-border p-6 rounded-lg"
        >
          <h3 className="font-hand text-2xl font-bold text-primary mb-6">Volume Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={stats.volumeByExercise.slice(0, 5)}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="volume"
              >
                {stats.volumeByExercise.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </motion.section>

        {/* Goal Progress */}
        {goals.length > 0 && (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="bg-white border-2 border-border p-6 rounded-lg"
          >
            <h3 className="font-hand text-2xl font-bold text-primary mb-6">Goal Progress</h3>
            <div className="space-y-4">
              {goals.map((goal) => {
                const percentage = Math.min(100, (goal.current / goal.target) * 100);
                return (
                  <div key={goal.id} className="space-y-2" data-testid={`goal-progress-${goal.id}`}>
                    <div className="flex justify-between items-center">
                      <span className="font-mono font-bold">{goal.exercise}</span>
                      <span className="font-mono text-sm text-muted-foreground">
                        {goal.current} / {goal.target}{goal.unit}
                      </span>
                    </div>
                    <div className="relative h-3 bg-muted/30 rounded-full overflow-hidden border border-primary/5">
                      <div
                        className="absolute top-0 left-0 h-full bg-accent/80 transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-muted-foreground">{Math.round(percentage)}%</span>
                  </div>
                );
              })}
            </div>
          </motion.section>
        )}

        {/* Exercise Details Table */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="bg-white border-2 border-border p-6 rounded-lg"
        >
          <h3 className="font-hand text-2xl font-bold text-primary mb-6">All Exercises</h3>
          <div className="overflow-x-auto">
            <table className="w-full font-mono text-sm">
              <thead>
                <tr className="border-b-2 border-primary/10">
                  <th className="text-left py-2 px-2">Exercise</th>
                  <th className="text-right py-2 px-2">Workouts</th>
                  <th className="text-right py-2 px-2">Max Weight</th>
                  <th className="text-right py-2 px-2">Total Volume</th>
                </tr>
              </thead>
              <tbody>
                {stats.exerciseList.map((exercise, i) => (
                  <tr key={exercise.name} className="border-b border-primary/5 hover:bg-primary/5 transition-colors" data-testid={`row-exercise-${exercise.name}`}>
                    <td className="py-3 px-2 font-bold">{exercise.name}</td>
                    <td className="text-right py-3 px-2">{exercise.workouts}</td>
                    <td className="text-right py-3 px-2">{exercise.maxWeight} lbs</td>
                    <td className="text-right py-3 px-2">{(exercise.volume / 1000).toFixed(1)}k lbs</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.section>
      </div>
    </Layout>
  );
}
