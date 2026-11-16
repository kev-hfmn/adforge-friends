/** A layout-shaped placeholder. Pulse only, and still when motion is reduced. */
export function Bone({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-muted motion-reduce:animate-none ${className}`}
    />
  );
}
