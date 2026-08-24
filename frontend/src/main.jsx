import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { AuthProvider } from "./lib/AuthContext.jsx";
import { ThemeProvider } from "./lib/ThemeContext.jsx";
import "./styles/index.css";
import "./styles/lumen.css";

try {
  const t = localStorage.getItem("meet_theme");
  document.documentElement.setAttribute(
    "data-theme",
    t === "light" || t === "dark" ? t : "dark"
  );
} catch {
  document.documentElement.setAttribute("data-theme", "dark");
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
