import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-extrabold transition duration-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ink/10 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-ink text-cream shadow-float hover:-translate-y-0.5 hover:shadow-soft dark:bg-cream dark:text-charcoal",
        secondary: "border border-line bg-paper/80 text-ink shadow-float hover:-translate-y-0.5 hover:border-ink dark:text-cream dark:hover:border-cream",
        ghost: "text-muted hover:bg-ink/5 hover:text-ink dark:hover:bg-cream/10 dark:hover:text-cream"
      },
      size: {
        default: "min-h-12 px-5",
        icon: "size-11 px-0",
        sm: "min-h-10 px-4 text-xs"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export function Button({ className, variant, size, asChild = false, ...props }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { buttonVariants };
