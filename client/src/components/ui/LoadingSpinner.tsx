import { Loader2 } from "lucide-react";

export function LoadingSpinner({ className = "", size = 24 }: { className?: string, size?: number }) {
  return (
    <Loader2 
      size={size} 
      className={`animate-spin text-primary ${className}`} 
    />
  );
}
