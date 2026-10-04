import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import { Store } from "./store";
import App from "./App";
import "./styles/global.css";
import { staticHosting } from "./config";
const Router = staticHosting ? HashRouter : BrowserRouter;
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Router>
      <Store>
        <App />
      </Store>
    </Router>
  </React.StrictMode>,
);
