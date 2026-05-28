import React from "react";
import { cn } from "@/lib/utils";

export const Spinner: React.FC<{ className?: string }> = ({ className }) => (
  <div className="flex justify-center items-center p-4">
    <div
      className={cn(
        "w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin",
        className
      )}
    />
  </div>
);
