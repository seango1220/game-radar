# Game Radar

A compact PWA widget for at-a-glance upcoming video game releases and gaming showcases.

The first version is intentionally keyless: it pulls upcoming release and event dates from the public Wikidata Query Service. When a game's release date is corrected there, the widget picks up the change on the next sync. The app also caches the last successful sync for offline or flaky-network use.

## Run locally

```powershell
.\start-widget-server.ps1
```

Then open:

```text
http://localhost:4173
```

## Install locally on Windows

Run this once to start the local server automatically when you sign in and create a desktop shortcut:

```powershell
.\install-local-widget.ps1
```

To remove the startup task and shortcut:

```powershell
.\uninstall-local-widget.ps1
```

## Desktop Widget Window

Create a compact app-style desktop shortcut:

```powershell
.\install-desktop-widget-shortcut.ps1
```

Then open **Game Radar Widget** from your desktop. It launches Edge or Chrome in app mode at a compact window size.

## Install on Android

Open a hosted HTTPS URL in Chrome on Android and choose **Add to Home screen**. Android PWAs do not get a full native home-screen widget surface by default, but they do launch as a standalone app-like view. See [PHONE_SETUP.md](PHONE_SETUP.md) for hosting notes.

## Data strategy

- Games: Wikidata items that are video games with publication dates in the next year.
- Major-game filtering: the app keeps items with at least eight Wikidata sitelinks, which usually removes small or incomplete entries.
- Events: public Wikidata event dates, plus several known gaming-event series.
- Official event feed: the local server also checks PlayStation Blog RSS for State of Play announcements.
- Sync cadence: live data is cached for six hours.

For richer coverage, the next step is adding an optional server-side feed that uses IGDB or RAWG with an API key. Those services provide better game metadata and artwork, but they require credentials and should not be called directly from client-side JavaScript.
