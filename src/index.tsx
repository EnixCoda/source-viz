import { createRoot } from "react-dom/client";
import { App } from "./components/App";
import "./style.css";

const container = document.querySelector("#app");
if (container) createRoot(container).render(<App />);
