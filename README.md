# Xbox Store Price Checker

React app that searches the Microsoft Xbox catalog and compares purchase prices across regional stores.

## Run

```bash
npm install
npm run dev
```

Open the local Vite URL, search a game, then sort regional prices in your preferred currency.

The Microsoft display catalog and exchange-rate APIs are proxied in `vite.config.js` so the browser can call them during development.
