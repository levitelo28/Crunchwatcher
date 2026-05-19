import { cn } from "@/lib/utils";

export function Card({ className, ...props }) {
  return (
    <div
      className={cn("rounded-2xl border border-line bg-paper/90 p-5 shadow-soft backdrop-blur", className)}
      {...props}
    />
  );
}
