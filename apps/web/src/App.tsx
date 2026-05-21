import { Routes, Route, Link, useLocation } from "react-router-dom"
import Dashboard from "./pages/Dashboard.js"
import RouteProfiles from "./pages/RouteProfiles.js"
import Presets from "./pages/Presets.js"
import Providers from "./pages/Providers.js"
import Logs from "./pages/Logs.js"
import Playground from "./pages/Playground.js"
import Graph from "./pages/Graph.js"

const navItems = [
  { path: "/", label: "Dashboard" },
  { path: "/profiles", label: "Profiles" },
  { path: "/presets", label: "Presets" },
  { path: "/providers", label: "Providers" },
  { path: "/logs", label: "Logs" },
  { path: "/playground", label: "Playground" },
  { path: "/graph", label: "Graph" },
]

export default function App() {
  const location = useLocation()

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0f1115", color: "#e5e7eb" }}>
      <nav style={{ width: 180, padding: 16, borderRight: "1px solid #1f2937" }}>
        <h2 style={{ margin: "0 0 16px", fontSize: 18, color: "#60a5fa" }}>OpenGate</h2>
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {navItems.map((item) => (
            <li key={item.path} style={{ marginBottom: 8 }}>
              <Link
                to={item.path}
                style={{
                  display: "block",
                  padding: "6px 10px",
                  borderRadius: 6,
                  textDecoration: "none",
                  color: location.pathname === item.path ? "#fff" : "#9ca3af",
                  background: location.pathname === item.path ? "#2563eb" : "transparent",
                }}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <main style={{ flex: 1, padding: 24 }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/profiles" element={<RouteProfiles />} />
          <Route path="/presets" element={<Presets />} />
          <Route path="/providers" element={<Providers />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/playground" element={<Playground />} />
          <Route path="/graph" element={<Graph />} />
        </Routes>
      </main>
    </div>
  )
}
