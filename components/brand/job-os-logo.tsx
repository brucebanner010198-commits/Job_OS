import { cn } from "@/lib/utils";

export function JobOsLogo({
  variant = "full",
  className,
}: {
  variant?: "full" | "icon";
  className?: string;
}) {
  if (variant === "icon") {
    // Inlined (not <img src>) so the mark's `currentColor` fills inherit the
    // theme `text-foreground`; an external SVG via <img> ignores currentColor
    // and would render near-black (invisible on dark surfaces). Design/geometry
    // identical to public/brand/logo-icon.svg. Destination node is theme-aware.
    return (
      <svg
        viewBox="0 0 32 32"
        fill="none"
        role="img"
        aria-label="Job OS"
        className={cn("h-8 w-8 text-foreground", className)}
      >
        <title>Job OS</title>
        <path d="M4 9V4H9" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" opacity={0.3} />
        <path d="M28 23V28H23" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" opacity={0.3} />
        <path
          d="M10.5 22.5L13.5 18.5M15.5 18.5L18.5 14.5M20.5 14.5L23.5 10.5"
          stroke="currentColor"
          strokeWidth={1.25}
          strokeLinecap="round"
          opacity={0.45}
        />
        <rect x={5.5} y={19.5} width={5} height={5} rx={1.25} fill="currentColor" opacity={0.22} />
        <rect x={10.5} y={15.5} width={5} height={5} rx={1.25} fill="currentColor" opacity={0.42} />
        <rect x={15.5} y={11.5} width={5} height={5} rx={1.25} fill="currentColor" opacity={0.62} />
        <rect
          x={20.5}
          y={7.5}
          width={5}
          height={5}
          rx={1.25}
          fill="#16a34a"
          className="fill-[#16a34a] dark:fill-[#22c55e]"
        />
        <path
          d="M23 10.5V9.5M23 10.5L22.25 9.75M23 10.5L23.75 9.75"
          stroke="#fafafa"
          strokeWidth={0.9}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/logo.svg"
        alt="Job OS"
        className={cn("h-7 w-auto dark:hidden", className)}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/logo-dark.svg"
        alt="Job OS"
        className={cn("hidden h-7 w-auto dark:block", className)}
      />
    </>
  );
}
