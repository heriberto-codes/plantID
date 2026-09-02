# PlantID

**[View the live demo](https://plantid-heriberto.fly.dev/)**

PlantID is a browser-based plant identification demo. Upload a plant photo to receive a likely species match, confidence information, common names, a description, health status, possible disease information, and treatment suggestions.

The app is built with semantic HTML, custom responsive CSS, Bootstrap Icons, vanilla JavaScript, and a small Node.js server. It uses the [Plant.id API](https://plant.id/) for identification.

## Features

- Upload a plant photo from your device
- Preview the selected image
- Identify the likely plant species
- Display confidence and common-name information
- Check whether the plant appears healthy
- Show possible disease details and treatment suggestions
- Display visually similar images returned by Plant.id

## Run locally

Node.js 22 or newer is required. Copy the environment template and add your Plant.id API key:

```bash
cp .env.example .env
```

Then start the development server:

```bash
npm run dev
```

Open [http://127.0.0.1:8000/](http://127.0.0.1:8000/) in a browser.

No dependency installation or build step is required. Opening `index.html` directly will not work because plant-identification requests are handled by the Node server.

## How to use it

1. Select **Choose File**.
2. Pick a clear photo containing a plant.
3. Select **Analyze plant**.
4. Wait for Plant.id to process the image.
5. Review the identification and plant-health sections.

Clear, well-lit photos with the plant filling most of the frame generally provide better results.

## Project structure

```text
plantid/
├── assets/         # Optimized botanical photography
├── .env.example    # Server environment variable template
├── index.html      # Semantic page structure and interface
├── style.css       # Living Gallery visual system and responsive layout
├── script.js       # Browser interaction, states, and result rendering
├── server.js       # Static server and protected Plant.id proxy
├── package.json    # Local server commands and Node version
├── codealike.json  # Editor tooling configuration
└── README.md       # Project documentation
```

## Plant.id integration

The browser converts the selected image to a Base64 data URL and sends it to the local `/api/identify` endpoint. The Node server adds the private API key and forwards the request to Plant.id v3. The browser never receives the key.

API requests may count against the limits or credits associated with the configured Plant.id account.

## Important security note

The active Plant.id key must be stored as `PLANT_ID_API_KEY` in `.env` locally or as a secret environment variable on the hosting platform. `.env` is ignored by Git and must never be committed.

The previous test key was committed in an earlier version of this repository. Removing it from the latest JavaScript prevents normal browser exposure, but it may remain discoverable in Git history. Rotate it if it will ever receive production access or billing.

The server validates request type and size. A public deployment should also add rate limiting to prevent other people from consuming the API quota through the proxy.

## Publishing checklist

- Configure `PLANT_ID_API_KEY` as a hosting-platform secret
- Add rate limiting to `/api/identify`
- Test empty, invalid, oversized, and non-plant uploads
- Verify the layout on mobile and desktop
- Add project metadata, social preview tags, and a favicon
- Connect the finished deployment from the main portfolio homepage

## Current status

The Plant.id endpoint and request format have been tested successfully with a sunflower image. The key has been removed from client-side JavaScript and API requests now pass through the local Node server.

This project is ready for local testing. Configure a server-capable host and add rate limiting before making it public.
