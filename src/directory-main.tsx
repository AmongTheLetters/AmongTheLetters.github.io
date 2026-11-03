import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DirectoryApp } from "./DirectoryApp";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DirectoryApp />
  </StrictMode>,
);
