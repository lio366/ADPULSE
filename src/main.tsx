import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import AuthGate from "./AuthGate";
import "./index.css";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root container not found.");
}

createRoot(container).render(
  <React.StrictMode>
    <AuthGate>
      {(session) => {
        const tenant = [
          { id: "tenant-autofix", name: "Autofix Center" },
          { id: "tenant-ruta-24", name: "Ruta 24" },
          { id: "tenant-moto-verde", name: "Moto Verde" },
        ].find((item) => item.id === session.tenantId);
        return <App initialTenant={tenant?.name ?? "Autofix Center"} />;
      }}
    </AuthGate>
  </React.StrictMode>,
);
