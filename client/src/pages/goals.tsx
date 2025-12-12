import { useState } from "react";
import { useForm } from "react-hook-form";
import Layout from "@/components/layout";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import type { Goal, InsertGoal, UpdateGoal } from "@shared/schema";

export default function Goals() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTarget, setEditTarget] = useState<number>(0);

  const { data: goals = [], isLoading } = useQuery<Goal[]>({
    queryKey: ['/api/goals'],
    queryFn: async () => {
      const response = await fetch('/api/goals');
      if (!response.ok) throw new Error('Failed to fetch goals');
      return response.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertGoal) => {
      const response = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create goal');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
      reset();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ exercise, updates }: { exercise: string; updates: UpdateGoal }) => {
      const response = await fetch(`/api/goals/${encodeURIComponent(exercise)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update goal');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/goals/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete goal');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
    },
  });

  const { register, handleSubmit, reset } = useForm<InsertGoal>({
    defaultValues: { unit: 'lbs' }
  });

  const onSubmit = (data: InsertGoal) => {
    createMutation.mutate(data);
  };

  const updateProgress = (exercise: string, newVal: number) => {
    updateMutation.mutate({ exercise, updates: { current: newVal } });
  };

  const startEditing = (goal: Goal) => {
    setEditingId(goal.id);
    setEditTarget(goal.target);
  };

  const saveTarget = (exercise: string) => {
    updateMutation.mutate({ exercise, updates: { target: editTarget } });
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

        {/* Add New Goal Form */}
        <section className="bg-card border-2 border-border p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] rotate-[0.5deg]">
          <h3 className="font-hand text-xl mb-4 text-primary flex items-center gap-2">
            <Plus className="w-5 h-5 text-accent" /> Add New Goal
          </h3>
          
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-12 gap-4 items-end">
              <div className="col-span-2 md:col-span-4">
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider block mb-1">Exercise</label>
                <Input 
                  type="text" 
                  data-testid="input-goal-exercise"
                  {...register("exercise", { required: true })}
                  className="font-mono bg-transparent border-0 border-b-2 border-muted-foreground/20 rounded-none focus-visible:ring-0 px-0 focus-visible:border-primary"
                  placeholder="e.g. Squat, Deadlift..."
                />
              </div>

              <div className="md:col-span-3">
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider block mb-1">Current (lbs)</label>
                <Input 
                  type="number" 
                  data-testid="input-goal-current"
                  {...register("current", { required: true, valueAsNumber: true })}
                  className="font-mono bg-transparent border-0 border-b-2 border-muted-foreground/20 rounded-none focus-visible:ring-0 px-0 focus-visible:border-primary"
                  placeholder="0"
                />
              </div>

              <div className="md:col-span-3">
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider block mb-1">Target (lbs)</label>
                <Input 
                  type="number" 
                  data-testid="input-goal-target"
                  {...register("target", { required: true, valueAsNumber: true })}
                  className="font-mono bg-transparent border-0 border-b-2 border-muted-foreground/20 rounded-none focus-visible:ring-0 px-0 focus-visible:border-primary"
                  placeholder="0"
                />
              </div>

              <div className="md:col-span-2">
                <Button 
                  type="submit" 
                  data-testid="button-add-goal"
                  className="w-full font-hand text-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? 'Adding...' : 'Add Goal'}
                </Button>
              </div>
            </div>
          </form>
        </section>

        {/* Goals Grid */}
        {goals.length === 0 ? (
          <div className="p-8 text-center font-hand text-2xl text-muted-foreground/50 border-2 border-dashed border-muted-foreground/20 rounded-lg">
            No goals set yet. Add your first target above!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <AnimatePresence>
              {goals.map((goal, index) => {
                const percentage = Math.min(100, Math.max(0, (goal.current / goal.target) * 100));
                const isEditing = editingId === goal.id;
                
                return (
                  <motion.div
                    key={goal.id}
                    data-testid={`card-goal-${goal.id}`}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: index * 0.1 }}
                    className="relative bg-white p-6 shadow-sm border border-primary/10 rotate-[-1deg] hover:rotate-0 transition-transform duration-300 group"
                  >
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-24 h-6 bg-yellow-100/80 shadow-sm rotate-1"></div>

                    {/* Delete button */}
                    <button
                      onClick={() => deleteMutation.mutate(goal.id)}
                      data-testid={`button-delete-goal-${goal.id}`}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:bg-destructive/10 p-1.5 rounded-full"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <div className="flex justify-between items-baseline mb-4">
                      <h3 className="font-hand text-2xl font-bold" data-testid={`text-goal-exercise-${goal.id}`}>
                        {goal.exercise}
                      </h3>
                      
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={editTarget}
                            onChange={(e) => setEditTarget(parseInt(e.target.value) || 0)}
                            className="w-20 h-8 font-mono text-sm"
                            data-testid={`input-edit-target-${goal.id}`}
                          />
                          <button
                            onClick={() => saveTarget(goal.exercise)}
                            className="text-green-600 hover:bg-green-100 p-1 rounded"
                            data-testid={`button-save-target-${goal.id}`}
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-muted-foreground hover:bg-muted p-1 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEditing(goal)}
                          className="font-mono text-sm text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                          data-testid={`button-edit-target-${goal.id}`}
                        >
                          Target: {goal.target}{goal.unit}
                          <Pencil className="w-3 h-3" />
                        </button>
                      )}
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
            </AnimatePresence>
          </div>
        )}
      </div>
    </Layout>
  );
}
