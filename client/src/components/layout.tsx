import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-3xl mx-auto">
      <header className="mb-8 flex items-end justify-between border-b-2 border-primary/10 pb-4">
        <div>
          <h1 className="text-4xl font-hand font-bold text-primary -rotate-1 transform origin-bottom-left">
            Strength Log
          </h1>
          <p className="text-sm font-mono text-muted-foreground mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        
        <nav className="flex gap-6 font-hand text-xl">
          <Link href="/">
            <span className={cn(
              "hover:text-accent transition-colors relative cursor-pointer",
              location === "/" && "text-accent font-bold after:content-[''] after:absolute after:-bottom-1 after:left-0 after:w-full after:h-0.5 after:bg-accent/50 after:rounded-full"
            )}>
              Daily Log
            </span>
          </Link>
          <Link href="/dashboard">
            <span className={cn(
              "hover:text-accent transition-colors relative cursor-pointer",
              location === "/dashboard" && "text-accent font-bold after:content-[''] after:absolute after:-bottom-1 after:left-0 after:w-full after:h-0.5 after:bg-accent/50 after:rounded-full"
            )}>
              Dashboard
            </span>
          </Link>
          <Link href="/goals">
            <span className={cn(
              "hover:text-accent transition-colors relative cursor-pointer",
              location === "/goals" && "text-accent font-bold after:content-[''] after:absolute after:-bottom-1 after:left-0 after:w-full after:h-0.5 after:bg-accent/50 after:rounded-full"
            )}>
              Yearly Goals
            </span>
          </Link>
        </nav>
      </header>
      
      <main className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        {children}
      </main>
    </div>
  );
}
