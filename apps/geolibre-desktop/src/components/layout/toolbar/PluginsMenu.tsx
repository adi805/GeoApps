import {
  COMPONENTS_PLUGIN_ID,
  DECK_VIZ_PLUGIN_ID,
  DGGS_PLUGIN_IDS,
  DIRECTIONS_PLUGIN_ID,
  type GeoLibreMapControlPosition,
  GRATICULE_PLUGIN_ID,
  LAYER_CONTROL_PLUGIN_ID,
  CLOUDS_PLUGIN_ID,
  PRECIPITATION_PLUGIN_ID,
  REVERSE_GEOCODE_PLUGIN_ID,
  EFFECTS_PLUGIN_ID,
  ROUTE_ANIMATION_PLUGIN_ID,
  SUN_PLUGIN_ID,
  WEB_SERVICE_PLUGIN_IDS,
  type GeoLibreToolbarMenu,
  isPluginEngineSupported,
  isKebunPlugin,
  resolveToolbarLabel,
} from "@geolibre/plugins";
import { useAppStore } from "@geolibre/core";
import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@geolibre/ui";
import { Puzzle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDesktopSettingsStore } from "../../../hooks/useDesktopSettings";
import { useToolbarMenus } from "../../../hooks/usePluginUiSurfaces";
import type { usePluginRegistry } from "../../../hooks/usePlugins";
import { isExternalPluginId } from "../../../lib/external-plugins";
import { partitionPlugins } from "./plugin-sections";
import { pluginDisplayName, sortPluginsByDisplayName } from "../../../lib/plugin-display-name";
import { toolbarMenusByOwner, withPluginMenuFolded } from "../../../lib/plugin-toolbar-menus";
import { type AppApi, PLUGIN_POSITION_ITEMS, type ToolbarChrome } from "./constants";
import { renderItems } from "./PluginToolbarMenus";

type PluginRegistry = ReturnType<typeof usePluginRegistry>;
type RegisteredPlugin = PluginRegistry["plugins"][number];

// Plugins grouped under the "Web Services" submenu of the Plugins menu.
const WEB_SERVICE_PLUGIN_ID_SET = new Set<string>(WEB_SERVICE_PLUGIN_IDS);

// The discrete global grids (H3, S2, A5) grouped under the "DGGS" submenu.
const DGGS_PLUGIN_ID_SET = new Set<string>(DGGS_PLUGIN_IDS);

/**
 * Whether the Plugins menu leaves this plugin out entirely.
 *
 * Atmospheric Effects, Directions, Reverse Geocode, Gridlines, the Weather
 * overlays (Clouds, Precipitation) and Layer Control are toggled from the
 * Controls menu instead, so listing them here would offer a second switch for
 * the same plugin. The deck.gl viz overlay is an internal renderer driven by the
 * Add Data → "Deck.gl Layer" dialog, and the Components plugin stays registered
 * for in-app use with its catch-all grid hidden now that its panels are
 * reachable through dedicated plugins.
 *
 * The comparisons stay literal, one exported id constant per line, because
 * `scripts/gen-plugin-reference.mjs` reads this list from the source to decide
 * which plugins need a hand-written menu location in its reference table.
 */
function isLeftOutOfPluginsMenu(p: RegisteredPlugin): boolean {
  return (
    p.id === EFFECTS_PLUGIN_ID ||
    p.id === SUN_PLUGIN_ID ||
    p.id === ROUTE_ANIMATION_PLUGIN_ID ||
    p.id === DIRECTIONS_PLUGIN_ID ||
    p.id === REVERSE_GEOCODE_PLUGIN_ID ||
    p.id === GRATICULE_PLUGIN_ID ||
    p.id === CLOUDS_PLUGIN_ID ||
    p.id === PRECIPITATION_PLUGIN_ID ||
    p.id === DECK_VIZ_PLUGIN_ID ||
    p.id === LAYER_CONTROL_PLUGIN_ID ||
    p.id === COMPONENTS_PLUGIN_ID
  );
}

interface PluginsMenuProps {
  chrome: ToolbarChrome;
  appApi: AppApi;
  plugins: RegisteredPlugin[];
  isActive: PluginRegistry["isActive"];
  toggle: PluginRegistry["toggle"];
  getMapControlPosition: PluginRegistry["getMapControlPosition"];
  setMapControlPosition: PluginRegistry["setMapControlPosition"];
  /** Plugin ids hidden by the active UI profile (issue #500). */
  hiddenPluginIds: Set<string>;
  /**
   * Opens the Manage Plugins dialog from the end of the Installed submenu.
   * Omitted where the host has no plugin marketplace (the Mac App Store build).
   */
  onOpenManagePlugins?: () => void;
}

/** The Plugins menu: one toggle per registered plugin, with position submenus. */
export function PluginsMenu({
  chrome,
  appApi,
  plugins,
  isActive,
  toggle,
  getMapControlPosition,
  setMapControlPosition,
  hiddenPluginIds,
  onOpenManagePlugins,
}: PluginsMenuProps) {
  const { t, i18n } = useTranslation();
  const primaryRenderer = useAppStore((state) => state.primaryRenderer);
  const { entries: toolbarMenuEntries } = useToolbarMenus();
  const foldedPluginMenus = useDesktopSettingsStore(
    (state) => state.desktopSettings.foldedPluginMenus,
  );

  // Show or hide an installed plugin's own top-level menus in the banner. A
  // hidden ("folded") menu renders inside the plugin's Installed entry instead,
  // so the user decides what occupies the menu bar (GeoLibre#2850).
  const setPluginMenuFolded = (pluginId: string, folded: boolean) => {
    const { desktopSettings, setDesktopSettings } = useDesktopSettingsStore.getState();
    setDesktopSettings({
      ...desktopSettings,
      foldedPluginMenus: withPluginMenuFolded(desktopSettings.foldedPluginMenus, pluginId, folded),
    });
  };

  // Only used for installed plugins, whose menus can be folded.
  const menusByOwner = toolbarMenusByOwner(toolbarMenuEntries);

  /**
   * One plugin's entry: a plain toggle, or a submenu when the plugin has a map
   * control position or (for installed plugins) top-level menus of its own.
   */
  const renderPluginMenuItem = (p: RegisteredPlugin, ownedMenus: GeoLibreToolbarMenu[] = []) => {
    const isSupported = isPluginEngineSupported(p, primaryRenderer);
    // A plugin that was activated under another renderer stays active after a
    // renderer switch, so its toggle must keep working even when the new
    // renderer does not support it — otherwise the only way to turn it off is
    // to switch the renderer back.
    const canToggle = isSupported || isActive(p.id);
    const pluginPosition = getMapControlPosition(p.id);
    const pluginName = pluginDisplayName(t, p);
    if (!pluginPosition && ownedMenus.length === 0) {
      return (
        <DropdownMenuItem
          key={p.id}
          disabled={!canToggle}
          // A greyed-out item still says why on hover, matching the command
          // palette's disabledReason for the same condition.
          title={!canToggle ? t("renderer.pluginUnsupported") : undefined}
          onClick={() => {
            if (!canToggle) return;
            toggle(p.id, appApi);
          }}
        >
          {pluginName}
          {isActive(p.id) ? " ✓" : ""}
        </DropdownMenuItem>
      );
    }

    return (
      <DropdownMenuSub key={p.id}>
        <DropdownMenuSubTrigger
          disabled={!canToggle}
          title={!canToggle ? t("renderer.pluginUnsupported") : undefined}
        >
          {pluginName}
          {isActive(p.id) ? " ✓" : ""}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuItem
            disabled={!canToggle}
            onClick={() => {
              if (!canToggle) return;
              toggle(p.id, appApi);
            }}
          >
            {isActive(p.id) ? t("toolbar.item.deactivate") : t("toolbar.item.activate")}
          </DropdownMenuItem>
          {pluginPosition ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>{t("toolbar.item.position")}</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={pluginPosition}
                onValueChange={(position: string) => {
                  if (!isSupported) return;
                  setMapControlPosition(p.id, appApi, position as GeoLibreMapControlPosition);
                }}
              >
                {PLUGIN_POSITION_ITEMS.map((position) => (
                  <DropdownMenuRadioItem
                    key={position.value}
                    value={position.value}
                    disabled={!isSupported}
                    onSelect={(event: Event) => event.preventDefault()}
                  >
                    {t(position.labelKey)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </>
          ) : null}
          {ownedMenus.length > 0 ? renderOwnedMenus(p.id, ownedMenus) : null}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    );
  };

  /**
   * The "Show menu in toolbar" switch for a plugin that registered top-level
   * menus, followed by those menus themselves while they are folded out of the
   * banner.
   */
  function renderOwnedMenus(pluginId: string, menus: GeoLibreToolbarMenu[]) {
    const folded = foldedPluginMenus.includes(pluginId);
    return (
      <>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={!folded}
          onCheckedChange={(checked: boolean) => setPluginMenuFolded(pluginId, !checked)}
          // Keep the submenu open so the folded menus appear (or vanish) in
          // place instead of dismissing the whole Plugins menu.
          onSelect={(event: Event) => event.preventDefault()}
        >
          {t("toolbar.item.showMenuInToolbar")}
        </DropdownMenuCheckboxItem>
        {folded ? (
          <>
            <DropdownMenuSeparator />
            {menus.map((menu) => (
              <DropdownMenuSub key={menu.id}>
                <DropdownMenuSubTrigger>
                  {resolveToolbarLabel(menu.label, menu.id)}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>{renderItems(menu.items, menu.id)}</DropdownMenuSubContent>
              </DropdownMenuSub>
            ))}
          </>
        ) : null}
      </>
    );
  }

  // The Web Services submenu has grown long, so its entries sort alphabetically
  // by their translated names (in the active locale's collation) rather than
  // following registration order.
  const webServicePlugins = sortPluginsByDisplayName(
    t,
    plugins.filter((p) => WEB_SERVICE_PLUGIN_ID_SET.has(p.id) && !hiddenPluginIds.has(p.id)),
    i18n.language,
  );
  // The web service plugins render as one grouped submenu below the curated
  // section, so the flat list never repeats their entries.
  const dggsPlugins = plugins.filter(
    (p) => DGGS_PLUGIN_ID_SET.has(p.id) && !hiddenPluginIds.has(p.id),
  );
  // The DGGS grid plugins (H3, S2, A5) render as one grouped submenu beside it.

  // Grouped submenus open when at least one member is usable on the active
  // renderer, or is still active from a previous one and needs turning off.
  const dggsSupported = dggsPlugins.some(
    (p) => isPluginEngineSupported(p, primaryRenderer) || isActive(p.id),
  );
  const webServicesSupported = webServicePlugins.some(
    (p) => isPluginEngineSupported(p, primaryRenderer) || isActive(p.id),
  );

  // Externally loaded plugins (registry, zip, manifest URL, bundled drop-in)
  // live in one alphabetical "Installed" submenu at the bottom of the menu
  // instead of being appended to the flat list (GeoLibre#2850). It is always a
  // submenu, even for a single plugin, so entries never jump between levels.
  const installedPlugins = sortPluginsByDisplayName(
    t,
    plugins.filter((p) => isExternalPluginId(p.id) && !hiddenPluginIds.has(p.id)),
    i18n.language,
  );

  // Every plugin this menu lists at all: registered, not left out above, not
  // hidden by the active UI profile, and not an external one (those live in the
  // Installed submenu). The KEBUN preset decides which of them are the curated
  // daily-work set, so the preset stays the only list of what belongs there.
  const listedPlugins = plugins.filter(
    (p) =>
      !isLeftOutOfPluginsMenu(p) && !hiddenPluginIds.has(p.id) && !isExternalPluginId(p.id),
  );
  // Web service and DGGS members keep their own grouped submenus below, so they
  // are sectioned out before the split rather than listed twice.
  const ungroupedPlugins = listedPlugins.filter(
    (p) => !WEB_SERVICE_PLUGIN_ID_SET.has(p.id) && !DGGS_PLUGIN_ID_SET.has(p.id),
  );
  const { primary: kebunPlugins, rest: otherPlugins } = partitionPlugins(
    ungroupedPlugins,
    (p) => isKebunPlugin(p.id),
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className={chrome.buttonClass}
          variant="ghost"
          size={chrome.buttonSize}
          aria-label={t("toolbar.menu.plugins")}
        >
          <Puzzle className={chrome.iconClassName} />
          {chrome.renderLabel(t("toolbar.menu.plugins"))}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {kebunPlugins.length > 0 ? (
          <>
            <DropdownMenuLabel>{t("toolbar.item.kebunPlugins", "Everyday plugins")}</DropdownMenuLabel>
            {kebunPlugins.map((p) => renderPluginMenuItem(p))}
            <DropdownMenuSeparator />
          </>
        ) : null}
        {otherPlugins.length > 0 ? (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              {t("toolbar.item.otherPlugins", "All plugins ({{count}})", { count: otherPlugins.length })}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {otherPlugins.map((p) => renderPluginMenuItem(p))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ) : null}
        {dggsPlugins.length > 0 ? (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={!dggsSupported}>
              {t("toolbar.item.dggs")}
              {dggsPlugins.some((plugin) => isActive(plugin.id)) ? " ✓" : ""}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {dggsPlugins.map((plugin) => renderPluginMenuItem(plugin))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ) : null}
        {webServicePlugins.length > 0 ? (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={!webServicesSupported}>
              {t("toolbar.item.webServices")}
              {webServicePlugins.some((plugin) => isActive(plugin.id)) ? " ✓" : ""}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {webServicePlugins.map((plugin) => renderPluginMenuItem(plugin))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ) : null}
        {installedPlugins.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            {/* Never disabled: even when no installed plugin runs on the
                active renderer, the submenu still leads to Manage Plugins. */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                {t("toolbar.item.installedPlugins")}
                {installedPlugins.some((plugin) => isActive(plugin.id)) ? " ✓" : ""}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {installedPlugins.map((plugin) =>
                  renderPluginMenuItem(plugin, menusByOwner.get(plugin.id)),
                )}
                {onOpenManagePlugins ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onOpenManagePlugins}>
                      {t("toolbar.item.managePlugins")}
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
