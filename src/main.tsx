import React from "react";
import ReactDOM from "react-dom/client";
// Bundled offline fonts (no external CDN). Variable = all weights in one file.
import "@fontsource-variable/inter";
import "@fontsource-variable/manrope";
import "@fontsource-variable/quicksand";
import "@fontsource-variable/jetbrains-mono";
import "react-grid-layout/css/styles.css";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
