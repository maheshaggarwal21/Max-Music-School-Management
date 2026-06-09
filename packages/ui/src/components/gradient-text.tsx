"use client";
import { theme } from "@maxmusic/ui/lib/theme";

export function GradientText({
  children, className = "",
  colors = [...theme.gradients.brandText],
  animationSpeed = 8, yoyo = true,
}: {
  children: React.ReactNode; className?: string;
  colors?: string[]; animationSpeed?: number; yoyo?: boolean;
}) {
  const gradient = [...colors, colors[0]].join(", ");
  const animName = yoyo ? "gradient-position-h-yoyo" : "gradient-position-h";
  return (
    <div className={`relative mx-auto flex max-w-fit items-center justify-center overflow-hidden ${className}`}>
      <div className="relative z-[2] inline-block bg-clip-text text-transparent" style={{
        backgroundImage: `linear-gradient(to right, ${gradient})`,
        backgroundSize: "300% 100%",
        animation: `${animName} ${animationSpeed}s ease infinite`,
        WebkitBackgroundClip: "text",
      }}>
        {children}
      </div>
    </div>
  );
}
