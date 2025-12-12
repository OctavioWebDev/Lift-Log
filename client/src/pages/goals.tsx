import { useState } from "react";
import Layout from "@/components/layout";
import { Slider } from "@/components/ui/slider";
import { motion } from "framer-motion";

type Goal = {
  exercise: string;
  current: number;
  target: number;
  unit: string;
};

export default function Goals() {
  const [goals, setGoals] = useState<Goal[]>([
    { exercise: "Squat", current: 315, target: 405, unit: "lbs" },
    { exercise: "Bench Press", current: 225, target: 315, unit: "lbs" },
    { exercise: "Deadlift", current: 405, target: 500, unit: "lbs" },
    { exercise: "Overhead Press", current: 135, target: 185, unit: "lbs" },
  ]);

  const updateProgress = (index: number, newVal: number) => {
    const newGoals = [...goals];
    newGoals[index].current = newVal;
    setGoals(newGoals);
  };

  return (
    <Layout>
      <div className="space-y-12">
        <div className="mb-8">
          <h2 className="font-hand text-3xl text-primary mb-2">2025 Targets</h2>
          <p className="font-mono text-muted-foreground text-sm max-w-md">
            "We are what we repeatedly do. Excellence, then, is not an act, but a habit."
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {goals.map((goal, index) => {
            const percentage = Math.min(100, Math.max(0, (goal.current / goal.target) * 100));
            
            return (
              <motion.div
                key={goal.exercise}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                className="relative bg-white p-6 shadow-sm border border-primary/10 rotate-[-1deg] hover:rotate-0 transition-transform duration-300"
              >
                {/* Tape effect */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-24 h-6 bg-yellow-100/80 shadow-sm rotate-1"></div>

                <div className="flex justify-between items-baseline mb-4">
                  <h3 className="font-hand text-2xl font-bold">{goal.exercise}</h3>
                  <span className="font-mono text-sm text-muted-foreground">
                    Target: {goal.target}{goal.unit}
                  </span>
                </div>

                <div className="relative h-4 bg-muted/30 rounded-full mb-6 overflow-hidden border border-primary/5">
                  {/* Scribble fill effect */}
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
                  <span className="font-mono font-bold w-12">{goal.current}</span>
                  <Slider 
                    value={[goal.current]} 
                    max={goal.target + 50} 
                    step={5}
                    onValueChange={(vals) => updateProgress(index, vals[0])}
                    className="flex-1"
                  />
                  <span className="font-mono text-xs text-muted-foreground w-12 text-right">{Math.round(percentage)}%</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
