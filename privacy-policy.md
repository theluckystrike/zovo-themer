# Zovo Themer Privacy Policy

Effective: September 2, 2026

Zovo Themer does not use analytics, advertising, tracking pixels or telemetry.
It does not sell personal information.

## Data stored on your device

The extension stores site hostnames, visual theme settings, picked CSS
selectors, generated rules, advanced user styles, the optional license key and
a time-limited license validation cache in Chrome local extension storage.
Visual theme profiles remain on the device unless Chrome sync or browser backup
behavior outside the extension copies them.

## Network activity

Zovo Themer does not transmit browsing history or visual theme profiles. When a
user explicitly submits a license key, the extension sends that key and the
product identifier `zovothemer` to the Zovo license verification endpoint
hosted on Supabase. The response is used only to decide whether Pro features
are active.

If the user enables optional advanced-style sync, the extension sends complete
advanced-style records—including CSS and URL or domain applicability—to the
provider the user selects (Google Drive, Dropbox, Microsoft OneDrive, or a
user-configured WebDAV server). The selected provider receives and retains
those records under the user's provider account and policies. OAuth tokens or
WebDAV credentials needed for that connection are stored by the extension.
After sync is enabled, it can run automatically every 30 minutes and when the
user requests it.

Installed advanced styles that specify an update URL may be checked
automatically, by default every 24 hours. Those checks contact the style's
configured source and may download updated CSS and style metadata. They do not
download or execute remote JavaScript.

## Permissions

Access to websites is required to apply the selected visual changes on those
pages. Storage is required to remember profiles and styles. Tabs, scripting and
navigation access support applying changes to the correct page and the
point-and-click selector. Context menus and alarms support retained style
management features.

## Retention and control

Theme profiles and advanced styles remain locally until the user removes them
or clears extension data. Synced advanced-style records remain with the chosen
provider until the user deletes them there or through the extension. The user
can disable sync, disconnect the provider, remove a license, disable automatic
style updates, or uninstall the extension. Uninstalling instructs Chrome to
remove local extension storage but does not itself delete provider-held copies.

## Contact

Privacy questions can be sent through https://zovo.one/.
