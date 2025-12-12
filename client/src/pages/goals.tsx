import { useState } from "react";
import Layout from "@/components/layout";
import { Slider } from "@/components/ui/slider";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Goal, UpdateGoal } from "@shared/schema";

export default function Goals() {
  const queryClient = useQueryClient();

  const { data: goals = [], isLoading } = useQuery<Goal[]>({
    queryKey: ['/api/goals'],
    queryFn: async () => {
      const response = await fetch('/api/goals');
      if (!response.ok) throw new Error('Failed to fetch goals');
      return response.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ exercise, updates }: { exercise: string; updates: UpdateGoal }) => {
      const response = await fetch(`/api/goals/${exercise}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update goal');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
    },
  });

  const updateProgress = (exercise: string, newVal: number) => {
    updateMutation.mutate({ exercise, updates: { current: newVal } });
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="p-8 text-center font-hand text-2xl text-muted-foreground/50">
          Loading...
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-12">
        <div className="mb-8">
          <h2 className="font-hand text-3xl text-primary mb-2">2025 Targets</h2>
          <p className="font-mono text-muted-foreground text-sm max-w-md">
            "We are what we repeatedly do. Excellence, then, is not an act, but a habit."
          </p>
        </div>

        {goals.length === 0 ? (
          <div className="p-8 text-center font-hand text-2xl text-muted-foreground/50 border-2 border-dashed border-muted-foreground/20 rounded-lg">
            No goals set yet. Start by adding some targets.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {goals.map((goal, index) => {
              const percentage = Math.min(100, Math.max(0, (goal.current / goal.target) * 100));
              
              return (
                <motion.div
                  key={goal.id}
                  data-testid={`card-goal-${goal.id}`}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className="relative bg-white p-6 shadow-sm border border-primary/10 rotate-[-1deg] hover:rotate-0 transition-transform duration-300"
                >
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-24 h-6 bg-yellow-100/80 shadow-sm rotate-1"></div>

                  <div className="flex justify-between items-baseline mb-4">
                    <h3 className="font-hand text-2xl font-bold" data-testid={`text-goal-exercise-${goal.id}`}>
                      {goal.exercise}
                    </h3>
                    <span className="font-mono text-sm text-muted-foreground" data-testid={`text-goal-target-${goal.id}`}>
                      Target: {goal.target}{goal.unit}
                    </span>
                  </div>

                  <div className="relative h-4 bg-muted/30 rounded-full mb-6 overflow-hidden border border-primary/5">
                    <motion.div 
                      className="absolute top-0 left-0 h-full bg-accent/80"
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      style={{
                        backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,0.3) 5px, rgba(255,255,255,0.3) 10px)"
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="font-mono font-bold w-12" data-testid={`text-goal-current-${goal.id}`}>
                      {goal.current}
                    </span>
                    <Slider 
                      value={[goal.current]} 
                      max={goal.target + 50} 
                      step={5}
                      onValueChange={(vals) => updateProgress(goal.exercise, vals[0])}
                      className="flex-1"
                      data-testid={`slider-goal-${goal.id}`}
                    />
                    <span className="font-mono text-xs text-muted-foreground w-12 text-right" data-testid={`text-goal-percentage-${goal.id}`}>
                      {Math.round(percentage)}%
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
