import * as React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./components/App";
import "./style.css";
import { AppProviders } from "./components/AppProviders";

const container = document.querySelector("#app");
if (container)
  createRoot(container).render(
    <React.StrictMode>
      <AppProviders>
        <App />
      </AppProviders>
    </React.StrictMode>
  );
