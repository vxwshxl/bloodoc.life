import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A laptop-browser frame around a product mock.
 *
 * The bezel is deliberately the one thing on this page that does *not* follow
 * the theme. A screen is a physical object; a MacBook does not turn white
 * because the page inside it is light, and a frame that flips with the theme
 * stops reading as hardware and starts reading as another card. Only the screen
 * area inside is themed — which is the point, since it is the product.
 *
 * `--bezel` / `--bezel-edge` still shift slightly between themes so the frame
 * keeps a visible edge against both a white and a near-black page.
 */
export function BrowserFrame({
  url = "bloodoc.life/admin",
  children,
  className,
  screenClassName,
}: {
  url?: string;
  children: React.ReactNode;
  className?: string;
  screenClassName?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl p-1.5 shadow-[var(--panel-shadow)] ring-1 ring-inset",
        className,
      )}
      style={{
        background: "var(--bezel)",
        // @ts-expect-error -- CSS custom property on a style object
        "--tw-ring-color": "var(--bezel-edge)",
      }}
    >
      {/* Chrome */}
      <div className="flex items-center gap-3 px-2 py-2">
        <div className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-(--tl-red)" />
          <span className="size-2.5 rounded-full bg-(--tl-amber)" />
          <span className="size-2.5 rounded-full bg-(--tl-green)" />
        </div>
        <div className="mx-auto flex max-w-[60%] min-w-0 items-center gap-1.5 rounded-md bg-white/8 px-3 py-1">
          <Lock className="size-2.5 shrink-0 text-white/40" strokeWidth={2.5} />
          <span className="truncate text-[10px] font-medium tracking-tight text-white/55">
            {url}
          </span>
        </div>
        <div className="w-10 shrink-0" aria-hidden />
      </div>

      {/* Screen */}
      <div className={cn("overflow-hidden rounded-xl bg-background", screenClassName)}>
        {children}
      </div>
    </div>
  );
}

/**
 * A phone frame for the hero. Same reasoning as the browser frame: hardware
 * colours stay fixed, the screen follows the theme.
 */
export function PhoneFrame({
  children,
  className,
  screenClassName,
}: {
  children: React.ReactNode;
  className?: string;
  screenClassName?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[2.25rem] p-2 shadow-[var(--panel-shadow)] ring-1 ring-inset",
        className,
      )}
      style={{
        background: "var(--bezel)",
        // @ts-expect-error -- CSS custom property on a style object
        "--tw-ring-color": "var(--bezel-edge)",
      }}
    >
      {/* Dynamic island */}
      <div
        aria-hidden
        className="absolute top-3.5 left-1/2 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-[var(--bezel)] ring-1 ring-black/40 ring-inset"
      />
      <div className={cn("overflow-hidden rounded-[1.75rem] bg-background", screenClassName)}>
        {children}
      </div>
    </div>
  );
}
