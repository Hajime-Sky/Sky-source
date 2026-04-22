# SkyReminderModules

This folder contains the split implementation used by `Sky_星の子リマインダー_v2.17_originalsin_impl2_dynfix18.js`.

The Scriptable root file remains in its original location and acts only as a loader. It reads `manifest.json`, loads the listed JavaScript parts from this folder in order, concatenates them, and executes the result inside one async wrapper. This keeps the original single-file execution order intact while making each part easier to edit and publish later.

## Parts

- `001_constants_and_navigation.js`: constants, action ids, navigation definitions, drawing defaults, and shared helpers.
- `002_settings_store_and_cache.js`: notification id helpers, default settings, normalization, keychain store, cache, and settings persistence.
- `003a_policy_time_and_common.js`: architecture policy, time helpers, common scheduling helpers, and update-time schedules.
- `003b_recurring_events_and_pan.js`: recurring event collectors, pan/forest advance logic, and completion markers.
- `003c_original_sin_and_dye.js`: Original Sin completion, idle-window candidate generation, and dye schedules.
- `003d_event_registry.js`: provider registry and UI field definitions for event types.
- `003e_scheduler_state.js`: settings change planning, schedule cache keys, run-state merge, and notification scheduling.
- `004a_tap_and_shard_data.js`: tap handling, shard calculations, and signal source data.
- `004b_signal_rendering.js`: short and long signal canvas rendering.
- `004c_draw_modes.js`: clock, list, timeline, and bar canvas drawing modes.
- `004d_widget_layout.js`: widget layout resolution, image generation dispatch, and preview card HTML.
- `005_app_ui_html_and_client.js`: interactive app screen HTML, CSS, browser-side UI state, and command dispatch client.
- `006_app_actions_backup_and_handlers.js`: WebView command handlers, settings export/import, backup file handling, and app-side mutation sync.
- `008_github_update_scaffold.js`: GitHub update metadata and manifest-diff planning helpers.
- `009_storage_migrations.js`: one-time storage migrations for legacy Keychain values and old file locations.
- `007_shortcut_entrypoint.js`: Shortcut/query handling, startup checks, runtime mode dispatch, and `Script.complete()`.

## GitHub update path

When this is moved to GitHub, publish this folder as-is under `SkyReminderModules` and keep unrelated repository files untouched. The current default manifest URL is `https://raw.githubusercontent.com/Hajime-Sky/Sky-source/main/SkyReminderModules/manifest.json`; if the existing Sky repository uses a different repo name or path, change it from the app UI.

The root Scriptable loader checks the remote manifest before running local modules. Update timing is controlled by `settings.githubUpdate.policy`:

- `missing`: update only when the local manifest or required part files are missing.
- `daily`: update when files are missing or at least 24 hours have passed since the previous check.
- `always`: check on every run and download changed files.

The loader downloads only changed or missing part files into Scriptable's local `SkyReminderModules` folder, then executes from that local folder just like the current split version.
