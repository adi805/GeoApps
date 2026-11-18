import { useRef, type ChangeEvent, type ReactNode } from "react";
import { Contrast, Crosshair, FileUp, FolderOpen, MapPin, Plus, Route, Save, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { FieldStatusReveal, FieldStatusStrip } from "./FieldStatusStrip";
import { MobileSheet } from "./MobileSheet";
import { MobileTabBar, type MobileTab } from "./MobileTabBar";

/** A labelled action row: 48 px tall, full width, thumb-reachable. */
function SheetAction({
  icon: Icon,
  label,
  onClick,
  testId,
  primary = false,
}: {
  icon: typeof MapPin;
  label: string;
  onClick: () => void;
  testId: string;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className={
        primary
          ? "flex min-h-12 w-full items-center gap-3 rounded-md bg-primary px-3 py-2 text-start text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          : "flex min-h-12 w-full items-center gap-3 rounded-md px-3 py-2 text-start text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      }
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

export interface MobileShellProps {
  /** False on a desktop-width viewport, where the chrome is the toolbar's job. */
  mobile: boolean;
  activeTab: MobileTab;
  onSelectTab: (tab: MobileTab) => void;
  statusStripVisible: boolean;
  onStatusStripVisibleChange: (visible: boolean) => void;
  highContrast: boolean;
  onHighContrastChange: (on: boolean) => void;
  /** Opens the existing Field Collection dialog for a new point. */
  onDropPoint: () => void;
  /** Opens the existing Field Collection dialog where the photo control lives. */
  onTakePhoto: () => void;
  /** Opens the existing GPS Tracking dialog. */
  onStartTrack: () => void;
  onSaveProject: () => void;
  onOpenProject: () => void;
  onNewProject: () => void;
  /** Opens the command palette: the same surface Cmd/Ctrl-K opens on desktop. */
  onOpenCommandPalette: () => void;
  /** Handed the chosen file; the shell adds it through the normal raster path. */
  onImportFile: (file: File) => void;
  children: ReactNode;
}

/**
 * The phone-width application chrome: a field status line, a five-tab bottom
 * navigation, and the sheets that replace the desktop toolbar's menus.
 *
 * It deliberately owns no data logic. Every action here calls into a handler the
 * desktop shell already owns (project save/open, raster import, the field
 * dialogs), so the mobile path and the desktop path cannot drift apart.
 *
 * Args:
 *   props: Tab state, the field/status actions, and the shell body (the map row).
 */
export function MobileShell({
  mobile,
  activeTab,
  onSelectTab,
  statusStripVisible,
  onStatusStripVisibleChange,
  highContrast,
  onHighContrastChange,
  onDropPoint,
  onTakePhoto,
  onStartTrack,
  onSaveProject,
  onOpenProject,
  onNewProject,
  onOpenCommandPalette,
  onImportFile,
  children,
}: MobileShellProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChosen = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset first: choosing the same file twice must fire a change event again.
    event.target.value = "";
    if (file) onImportFile(file);
  };

  const runAndClose = (action: () => void) => () => {
    onSelectTab("map");
    action();
  };

  // Desktop keeps the toolbar, the status bar and the side docks; the mobile
  // chrome would duplicate them, so the shell is transparent there.
  if (!mobile) return <>{children}</>;

  return (
    <div data-testid="mobile-shell" className="relative flex h-full min-h-0 w-full flex-col overflow-hidden">
      <FieldStatusStrip
        visible={statusStripVisible}
        onHide={() => onStatusStripVisibleChange(false)}
      />
      <div className="relative flex min-h-0 flex-1 flex-col">
        {statusStripVisible ? null : (
          <FieldStatusReveal onShow={() => onStatusStripVisibleChange(true)} />
        )}
        {children}
        <MobileSheet
          open={activeTab === "project"}
          onClose={() => onSelectTab("map")}
          title={t("mobile.sheet.project", "Proyek dan lapangan")}
          testId="mobile-project-sheet"
        >
          <div className="flex flex-col gap-2 p-2">
            {/* Search first: this row is the only one that reaches everything
                else, and a phone has neither Cmd/Ctrl-K nor the desktop menu
                that opens the palette. Typing a command name keeps the sheet
                usable as it grows past a screenful. */}
            <SheetAction
              icon={Search}
              label={t("mobile.action.commandPalette", "Cari perintah")}
              onClick={runAndClose(onOpenCommandPalette)}
              testId="mobile-action-command-palette"
            />
            <SheetAction
              icon={MapPin}
              label={t("mobile.action.dropPoint", "Taruh titik di sini")}
              onClick={runAndClose(onDropPoint)}
              testId="mobile-action-drop-point"
              primary
            />
            <SheetAction
              icon={Crosshair}
              label={t("mobile.action.takePhoto", "Ambil foto")}
              onClick={runAndClose(onTakePhoto)}
              testId="mobile-action-take-photo"
            />
            <SheetAction
              icon={Route}
              label={t("mobile.action.startTrack", "Mulai jejak")}
              onClick={runAndClose(onStartTrack)}
              testId="mobile-action-start-track"
            />
            <SheetAction
              icon={FileUp}
              label={t("mobile.action.importPdf", "Impor PDF / GeoTIFF")}
              onClick={() => fileInputRef.current?.click()}
              testId="mobile-action-import-file"
            />
            <SheetAction
              icon={Save}
              label={t("mobile.action.saveProject", "Simpan proyek")}
              onClick={runAndClose(onSaveProject)}
              testId="mobile-action-save-project"
            />
            <SheetAction
              icon={FolderOpen}
              label={t("mobile.action.openProject", "Buka proyek")}
              onClick={runAndClose(onOpenProject)}
              testId="mobile-action-open-project"
            />
            <SheetAction
              icon={Plus}
              label={t("mobile.action.newProject", "Proyek baru")}
              onClick={runAndClose(onNewProject)}
              testId="mobile-action-new-project"
            />
            <SheetAction
              icon={Contrast}
              label={
                highContrast
                  ? t("mobile.action.contrastOff", "Matikan kontras tinggi")
                  : t("mobile.action.contrastOn", "Nyalakan kontras tinggi")
              }
              onClick={() => onHighContrastChange(!highContrast)}
              testId="mobile-action-contrast"
            />
            {/* The file input stays out of the tab order and never receives
                focus: tapping the action opens the OS file picker directly, so
                the field flow needs no keyboard. */}
            <input
              ref={fileInputRef}
              type="file"
              tabIndex={-1}
              aria-hidden="true"
              data-testid="mobile-import-input"
              accept=".pdf,.tif,.tiff,.geotiff,.png,.jpg,.jpeg"
              className="hidden"
              onChange={handleFileChosen}
            />
          </div>
        </MobileSheet>
      </div>
      <MobileTabBar activeTab={activeTab} onSelect={onSelectTab} />
    </div>
  );
}
