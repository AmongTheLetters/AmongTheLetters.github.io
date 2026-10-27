import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MembershipApp } from "./MembershipApp";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MembershipApp />
  </StrictMode>,
);
