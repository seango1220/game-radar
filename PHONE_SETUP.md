# Phone Setup

Your Android phone cannot use your laptop's `localhost`, so the phone version needs a hosted HTTPS URL.

## Best Version: Hosted PWA

Deploy this folder as a small Node web app. The app already includes:

- `package.json` with `npm start`
- `server.js` for the app and event feed
- `manifest.webmanifest` for Android install
- PNG app icons for Android
- `render.yaml` for Render-style deployment

After deployment, open the hosted URL in Chrome on Android and choose:

```text
Menu > Add to Home screen
```

That gives you a standalone phone app icon. It will open full-screen without the browser address bar.

## Render Deployment Shape

Use these settings if deploying manually:

```text
Environment: Node
Build command: none
Start command: npm start
Port: use the platform-provided PORT variable
```

The server already reads `process.env.PORT`, so it should work on most Node hosts.

## True Android Widget

A real Android home-screen widget, the kind that shows content directly on the launcher without opening the app, needs a small native Android app. That can reuse this same hosted feed, but it is a separate Kotlin/Android project.
