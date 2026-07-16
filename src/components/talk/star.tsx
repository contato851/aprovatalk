import type { SVGProps } from "react";

/**
 * Talk 8-point star mark.
 */
export function TalkStar({
  className,
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
      {...props}
    >
      <path
        d="M50 2 L57 36 L86 14 L64 43 L98 50 L64 57 L86 86 L57 64 L50 98 L43 64 L14 86 L36 57 L2 50 L36 43 L14 14 L43 36 Z"
        fill="currentColor"
      />
    </svg>
  );
}
