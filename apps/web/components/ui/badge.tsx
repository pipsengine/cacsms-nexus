import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase", {
  variants: {
    variant: {
      default: "border-blue-200 bg-blue-50 text-blue-700",
      secondary: "border-slate-200 bg-slate-50 text-slate-700",
      success: "border-green-200 bg-green-50 text-green-700",
      warning: "border-orange-200 bg-orange-50 text-orange-700",
      destructive: "border-red-200 bg-red-50 text-red-700",
      purple: "border-purple-200 bg-purple-50 text-purple-700"
    }
  },
  defaultVariants: {
    variant: "default"
  }
});

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
