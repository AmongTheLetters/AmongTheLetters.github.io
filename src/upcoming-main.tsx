import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { UpcomingApp } from "./UpcomingApp";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <UpcomingApp />
  </StrictMode>,
);
