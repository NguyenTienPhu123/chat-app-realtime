import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import { SocketProvider } from "./contexts/SocketContext";
import { WebRTCProvider } from "./contexts/WebRTCContext";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <AuthProvider>
      <SocketProvider>
        <WebRTCProvider>
          <App />
        </WebRTCProvider>
      </SocketProvider>
    </AuthProvider>
  </BrowserRouter>,
);