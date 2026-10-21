import type { ReactNode } from "react";
import { ChevronLeft, Search } from "lucide-react";
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

/**
 * A section label above a group of rows, e.g. "Peta terakhir".
 *
 * The compositions draw this as an uppercase micro label rather than a heading
 * with weight: on a phone the label is a signpost for the rows under it, and
 * making it as loud as the project names would compete with them. It is still
 * an `h2`, so the document outline survives for a screen reader.
 */
export function MobileSectionHeading({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        "px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
        className,
      )}
    >
      {children}
    </h2>
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

/**
 * A tappable row: optional icon box, a title, a context line, then a badge and
 * a trailing value.
 *
 * The icon box is the compositions' 36 px rounded square, and it gives the list
 * a left edge the eye runs down: that is what makes three rows read as a list
 * instead of three paragraphs.
 *
 * When the row is tappable it stays a real `<button>`: opening a project has to
 * work from the keyboard, and its accessible name starts with the project name
 * so `e2e/helpers.ts` can find the seeded row by name.
 */
export function MobileListRow({
  icon,
  title,
  description,
  badge,
  trailing,
  onClick,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  badge?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const content = (
    <>
      {icon ? (
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent text-primary"
        >
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1 text-start">
        <span className="block truncate text-sm font-medium">{title}</span>
        {description ? (
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{description}</span>
        ) : null}
      </span>
      {badge}
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
  icon,
  title,
  description,
  detail,
  action,
  tone = "info",
  testId,
}: {
  icon?: ReactNode;
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
      {icon ? (
        <span
          aria-hidden="true"
          className="flex h-9 w-9 items-center justify-center rounded-md bg-background text-primary"
        >
          {icon}
        </span>
      ) : null}
      <p className="text-sm font-semibold">{title}</p>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      {detail ? (
        <p className="font-mono text-[11px] break-all text-muted-foreground">{detail}</p>
      ) : null}
      {action}
    </div>
  );
}

/**
 * A determinate progress bar: the compositions' `BilahKemajuan`.
 *
 * `valueText` exists because a number is not always the whole truth. The home
 * screen's storage bar has no measured total yet, so it reports zero with
 * "belum diukur" rather than letting a screen reader announce "0 percent" as if
 * the measurement had been taken (issue 118).
 */
export function MobileProgress({
  value,
  label,
  valueText,
  className,
}: {
  value: number;
  label: string;
  valueText?: string;
  className?: string;
}) {
  const percent = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={valueText}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
    </div>
  );
}

/** An icon-only action in a top bar. 48x48, and it must carry an accessible name. */
export function MobileIconButton({
  label,
  icon,
  onClick,
  expanded,
  controls,
  className,
}: {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  expanded?: boolean;
  controls?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-expanded={expanded}
      aria-controls={expanded === undefined ? undefined : controls}
      className={cn(
        "flex h-12 w-12 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
    >
      {icon}
    </button>
  );
}

/**
 * A search field for filtering the rows underneath it.
 *
 * The input is labelled by `aria-label` rather than a visible label: it sits
 * inside the top bar's slot on a phone, where a second text line would push the
 * list down for a control used once per visit.
 */
export function MobileSearchField({
  id,
  label,
  placeholder,
  value,
  onChange,
  className,
}: {
  id?: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (next: string) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-12 items-center gap-2 rounded-md border bg-background px-3",
        "focus-within:ring-2 focus-within:ring-ring",
        className,
      )}
    >
      <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <input
        id={id}
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-12 w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
