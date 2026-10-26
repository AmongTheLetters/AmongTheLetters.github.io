import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { OpportunitiesApp } from "./OpportunitiesApp";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <OpportunitiesApp />
  </StrictMode>,
);
