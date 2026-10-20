import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { cn } from "@geolibre/ui";

/**
 * Layout primitives for phone-width screens, taken from the visual language the
 * `visual/screens` compositions settled on (issue #69): one titled top bar, one
 * idea per card, labelled rows instead of tables, and a full-width primary
 * action at the end of the content.
 *
 * They live in production rather than importing `src/visual/**` so the app does
 * not depend on the gallery: the gallery may be rewritten or deleted without
 * touching the product. Only the layout decisions travel, never the sample data.
 *
 * Every interactive target clears 48 CSS px, which is the floor the field tests
 * settled on for a gloved thumb (the compositions' token says 44; the field
 * criterion for #69 says 48, and the stricter one wins).
 */

/** One screen's top bar: back, title, optional context line, badge, actions. */
export function MobileScreenHeader({
  title,
  description,
  badge,
  actions,
  onBack,
  className,
}: {
  title: string;
  description?: string;
  badge?: ReactNode;
  actions?: ReactNode;
  onBack?: () => void;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex shrink-0 items-center gap-2 border-b bg-background px-3 py-2",
        className,
      )}
    >
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="Kembali"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
      ) : null}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold leading-tight text-foreground">{title}</h1>
        {description ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {badge}
      {actions}
    </header>
  );
}

/** Scrollable body: one card per idea, with the screen's action at the end. */
export function MobileScreenBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3", className)}>
      {children}
    </div>
  );
}

/** A titled card. The title is what makes a group of rows scannable at arm's length. */
export function MobileCard({
  title,
  description,
  footer,
  children,
  className,
}: {
  title?: string;
  description?: string;
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-lg border bg-card text-card-foreground", className)}>
      {title || description ? (
        <div className="border-b px-3 py-2">
          {title ? <h2 className="text-sm font-semibold">{title}</h2> : null}
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
      ) : null}
      {children ? <div className="flex flex-col">{children}</div> : null}
      {footer ? <div className="border-t p-2">{footer}</div> : null}
    </section>
  );
}

/**
 * One labelled value: label on the start side, value on the end side.
 *
 * A field row is not a form input. It reports a number the app already knows
 * (latitude, accuracy, free space), which is why the value sits opposite its
 * label instead of under it: the eye compares values down the end column.
 */
export function MobileFieldRow({
  label,
  value,
  unit,
  mono = false,
  className,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-12 items-center justify-between gap-3 px-3 py-2", className)}>
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="flex min-w-0 items-baseline justify-end gap-1.5 text-end">
        <span
          className={cn("truncate text-sm font-medium", mono && "font-mono tabular-nums")}
        >
          {value}
        </span>
        {unit ? <span className="shrink-0 text-xs text-muted-foreground">{unit}</span> : null}
      </span>
    </div>
  );
}

/** A selectable category. 48 px tall so it can be hit while walking. */
export function MobileChip({
  label,
  selected = false,
  onSelect,
  className,
}: {
  label: string;
  selected?: boolean;
  onSelect?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "flex min-h-12 items-center rounded-full border px-4 text-sm font-medium transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        selected
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
        className,
      )}
    >
      {label}
    </button>
  );
}

/** The screen's primary action: full width, 48 px, always last in the body. */
export function MobileAction({
  label,
  icon,
  onClick,
  variant = "primary",
  disabled = false,
  testId,
  className,
}: {
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  testId?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex min-h-12 w-full items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-primary text-primary-foreground hover:bg-primary/90",
        variant === "secondary" && "border bg-background text-foreground hover:bg-accent",
        variant === "danger" && "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        className,
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

/** A tappable row with a title, a context line, and a trailing value. */
export function MobileListRow({
  title,
  description,
  trailing,
  onClick,
  className,
}: {
  title: string;
  description?: string;
  trailing?: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const content = (
    <>
      <span className="min-w-0 flex-1 text-start">
        <span className="block truncate text-sm font-medium">{title}</span>
        {description ? (
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{description}</span>
        ) : null}
      </span>
      {trailing}
    </>
  );
  if (!onClick) {
    return (
      <div className={cn("flex min-h-12 items-center gap-3 px-3 py-2", className)}>{content}</div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-12 items-center gap-3 px-3 py-2 text-start hover:bg-accent",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {content}
    </button>
  );
}

/** A status badge: the composition's `LencanaStatus`. */
export function MobileBadge({
  children,
  tone = "info",
  className,
}: {
  children: ReactNode;
  tone?: "info" | "success" | "warning" | "danger";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium",
        tone === "info" && "border-transparent bg-primary/10 text-primary",
        tone === "success" && "border-transparent bg-primary/10 text-primary",
        tone === "warning" && "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400",
        tone === "danger" && "border-transparent bg-destructive/10 text-destructive",
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * A state notice: empty, loading, error, offline, or permission refused.
 *
 * The compositions give each of these a full screen rather than a toast, because
 * a field worker who loses GPS or storage must be told what still works, not
 * just that something failed.
 */
export function MobileNotice({
  title,
  description,
  detail,
  action,
  tone = "info",
  testId,
}: {
  title: string;
  description?: string;
  detail?: string;
  action?: ReactNode;
  tone?: "info" | "success" | "warning" | "danger";
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex flex-col gap-2 rounded-lg border p-3",
        tone === "info" && "bg-muted/40",
        tone === "success" && "border-primary/30 bg-primary/5",
        tone === "warning" && "border-amber-500/40 bg-amber-500/10",
        tone === "danger" && "border-destructive/40 bg-destructive/5",
      )}
    >
      <p className="text-sm font-semibold">{title}</p>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      {detail ? (
        <p className="font-mono text-[11px] break-all text-muted-foreground">{detail}</p>
      ) : null}
      {action}
    </div>
  );
}
