import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ShopApp } from "./ShopApp";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ShopApp />
  </StrictMode>,
);
