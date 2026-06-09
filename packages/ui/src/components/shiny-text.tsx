"use client";
import { theme } from "@maxmusic/ui/lib/theme";

export function ShinyText({
  text, disabled = false, speed = 2, className = "",
  color = theme.colors.text.muted,
  shineColor = theme.colors.brand.accent,
  spread = 120, yoyo = false, delay = 0,
}: {
  text: string; disabled?: boolean; speed?: number; className?: string;
  color?: string; shineColor?: string; spread?: number;
  yoyo?: boolean; delay?: number;
}) {
  const animName = yoyo ? "shiny-text-yoyo" : "shiny-text-sweep";
  return (
    <span className={`inline-block ${className}`} style={{
      backgroundImage: `linear-gradient(${spread}deg, ${color} 0%, ${color} 35%, ${shineColor} 50%, ${color} 65%, ${color} 100%)`,
      backgroundSize: "200% auto",
      WebkitBackgroundClip: "text", backgroundClip: "text",
      WebkitTextFillColor: "transparent",
      animation: disabled ? "none" : `${animName} ${yoyo ? speed * 2 : speed}s linear ${delay}s infinite`,
    }}>
      {text}
    </span>
  );
}
