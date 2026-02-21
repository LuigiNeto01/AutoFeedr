import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { applyTheme, getSavedTheme } from "./lib/theme";

applyTheme(getSavedTheme());

createRoot(document.getElementById("root")).render(
  <App />,
);
