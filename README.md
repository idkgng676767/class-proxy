# Class Portal

A simple web proxy to bypass school network filtering.

## Usage

1. Open the portal URL in your browser
2. Enter any website URL (e.g., `snapchat.com`)
3. Click Go

## Self-hosted

Run on any server:

```bash
node server.js
```

Default port is 8081. Set `PORT` env var to change.

## How it works

The portal page sends requests through the server, which fetches the target website and returns it. To the school network, it looks like normal HTTPS traffic to your server.
