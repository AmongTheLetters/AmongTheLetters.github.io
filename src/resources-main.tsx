import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ResourcesApp } from "./ResourcesApp";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ResourcesApp />
  </StrictMode>,
);
