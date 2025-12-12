import { useState } from "react";
import { useForm } from "react-hook-form";
import { Plus, Trash2, Dumbbell } from "lucide-react";
import Layout from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";

type WorkoutSet = {
  id: string;
  exercise: string;
  weight: number;
  reps: number;
  rpe?: number;
};

const EXERCISES = [
  "Squat",
  "Bench Press",
  "Deadlift",
  "Overhead Press",
  "Barbell Row",
  "Pull Up",
  "Dumbbell Curl",
  "Tricep Extension",
];

export default function Home() {
  const [sets, setSets] = useState<WorkoutSet[]>([
    { id: "1", exercise: "Squat", weight: 225, reps: 5, rpe: 7 },
    { id: "2", exercise: "Squat", weight: 225, reps: 5, rpe: 7.5 },
  ]);

  const { register, handleSubmit, reset, setValue } = useForm<Omit<WorkoutSet, "id">>();

  const onSubmit = (data: Omit<WorkoutSet, "id">) => {
    const newSet = {
      ...data,
      id: Math.random().toString(36).substr(2, 9),
    };
    setSets([...sets, newSet]);
    // Keep exercise selected for convenience
    reset({ exercise: data.exercise, weight: data.weight, reps: data.reps });
  };

  const removeSet = (id: string) => {
    setSets(sets.filter((s) => s.id !== id));
  };

  return (
    <Layout>
      <div className="space-y-8">
        {/* Input Section - Looks like a form or sticky note */}
        <section className="bg-card border-2 border-border p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] rotate-[0.5deg]">
          <h2 className="font-hand text-2xl mb-4 text-primary flex items-center gap-2">
            <span className="text-accent">*</span> New Entry
          </h2>
          
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              <div className="md:col-span-5">
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider block mb-1">Exercise</label>
                <Select onValueChange={(val) => setValue("exercise", val)}>
                  <SelectTrigger className="font-mono bg-transparent border-0 border-b-2 border-muted-foreground/20 rounded-none focus:ring-0 px-0 focus:border-primary h-auto py-2">
                    <SelectValue placeholder="Select movement..." />
                  </SelectTrigger>
                  <SelectContent className="font-mono">
                    {EXERCISES.map((ex) => (
                      <SelectItem key={ex} value={ex}>{ex}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-3">
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider block mb-1">Weight (lbs)</label>
                <Input 
                  type="number" 
                  {...register("weight", { required: true, valueAsNumber: true })}
                  className="font-mono bg-transparent border-0 border-b-2 border-muted-foreground/20 rounded-none focus-visible:ring-0 px-0 focus-visible:border-primary"
                  placeholder="0"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider block mb-1">Reps</label>
                <Input 
                  type="number" 
                  {...register("reps", { required: true, valueAsNumber: true })}
                  className="font-mono bg-transparent border-0 border-b-2 border-muted-foreground/20 rounded-none focus-visible:ring-0 px-0 focus-visible:border-primary"
                  placeholder="0"
                />
              </div>

              <div className="md:col-span-2">
                <Button type="submit" className="w-full font-hand text-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm">
                  Log It
                </Button>
              </div>
            </div>
          </form>
        </section>

        {/* Log List */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-hand text-3xl text-primary relative inline-block">
              Today's Work
              <span className="absolute -bottom-1 left-0 w-full h-1 bg-yellow-200/60 -rotate-1"></span>
            </h2>
            <div className="font-mono text-sm text-muted-foreground">
              Total Volume: {sets.reduce((acc, s) => acc + (s.weight * s.reps), 0).toLocaleString()} lbs
            </div>
          </div>

          <div className="space-y-0">
            <AnimatePresence>
              {sets.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-8 text-center font-hand text-2xl text-muted-foreground/50 border-2 border-dashed border-muted-foreground/20 rounded-lg"
                >
                  Page is empty. Go lift something heavy.
                </motion.div>
              ) : (
                sets.map((set, i) => (
                  <motion.div
                    key={set.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: i * 0.05 }}
                    className="group flex items-center justify-between py-3 border-b border-primary/10 hover:bg-primary/5 px-2 transition-colors rounded-sm"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center text-primary/50 font-mono text-xs">
                        {i + 1}
                      </div>
                      <div>
                        <span className="font-bold font-mono text-lg text-primary">{set.exercise}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-8 font-mono text-lg">
                      <div className="w-24 text-right">
                        <span className="font-bold">{set.weight}</span> <span className="text-sm text-muted-foreground">lbs</span>
                      </div>
                      <div className="w-16 text-right">
                        <span className="font-bold">{set.reps}</span> <span className="text-sm text-muted-foreground">reps</span>
                      </div>
                      <button 
                        onClick={() => removeSet(set.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:bg-destructive/10 p-2 rounded-full"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </section>
      </div>
    </Layout>
  );
}
