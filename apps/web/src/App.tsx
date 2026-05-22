import { Routes, Route, NavLink, useLocation } from "react-router-dom"
import { Dropdown } from "primereact/dropdown"
import { Tag } from "primereact/tag"
import {
  Activity,
  Boxes,
  ChevronRight,
  CircleDot,
  Cpu,
  GitBranch,
  Logs as LogsIcon,
  Network,
  PanelBottom,
  PlugZap,
  Settings2,
  SquareTerminal,
} from "lucide-react"
import Logs from "./pages/Logs.js"
import Graph from "./pages/Graph.js"
import Configuration from "./pages/Configuration.js"
import Workspace from "./pages/Workspace.js"
import { RoutingTerminal } from "./studio/RoutingTerminal.js"
import { StudioProvider, useStudio } from "./studio/StudioContext.js"

const navItems = [
  { path: "/", label: "Workspace", icon: SquareTerminal },
  { path: "/graph", label: "Routing", icon: GitBranch },
  { path: "/logs", label: "Activity", icon: LogsIcon },
  { path: "/settings/providers", label: "Configuration", icon: Settings2 },
]

const resourceItems = [
  { path: "/settings/providers", label: "Providers", icon: PlugZap },
  { path: "/settings/experts", label: "Experts", icon: Cpu },
  { path: "/settings/profiles", label: "Profiles", icon: Boxes },
  { path: "/settings/presets", label: "Presets", icon: Network },
]

export default function App() {
  return (
    <StudioProvider>
      <StudioShell />
    </StudioProvider>
  )
}

function StudioShell() {
  const { profiles, profileSlug, setProfileSlug, isLoading } = useStudio()
  const location = useLocation()
  const logsFocused = location.pathname === "/logs"
  const configurationPath = ["/providers", "/experts", "/profiles", "/presets"].includes(location.pathname)
  const activeTitle =
    location.pathname.startsWith("/settings") || configurationPath
      ? "Configuration"
      : navItems.find((item) => location.pathname === item.path)?.label ?? "Workspace"
  const activeProfile = profiles.find((profile) => profile.slug === profileSlug)

  return (
    <div className={logsFocused ? "studio-shell studio-shell-logs" : "studio-shell"}>
      <header className="studio-titlebar">
        <div className="studio-window-title">
          <span className="studio-brand-mark">OG</span>
          <strong>OpenGate</strong>
        </div>
        <div className="studio-command-center">
          <SquareTerminal size={14} />
          <span>{activeProfile?.name ?? "Workspace"}</span>
          <ChevronRight size={13} />
          <strong>{activeTitle}</strong>
        </div>
        <Tag value={`/c/${profileSlug}/v1`} severity="info" />
      </header>
      <aside className="studio-activitybar">
        <nav>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              title={item.label}
              aria-label={item.label}
              className={({ isActive }) => (isActive ? "studio-activity-link is-active" : "studio-activity-link")}
            >
              <item.icon size={20} />
            </NavLink>
          ))}
        </nav>
      </aside>
      <aside className="studio-explorer">
        <div className="studio-explorer-head">Workspace</div>
        <section className="studio-explorer-block">
          <label>
            <span>Route profile</span>
            <Dropdown
              value={profileSlug}
              options={profiles}
              optionLabel="name"
              optionValue="slug"
              loading={isLoading}
              onChange={(event) => setProfileSlug(event.value)}
              placeholder="Route profile"
            />
          </label>
          <div className="studio-profile-meta">
            <CircleDot size={12} />
            <span>{activeProfile?.description || "Active routing workspace"}</span>
          </div>
        </section>
        <ExplorerGroup title="Workbench">
          {navItems.slice(0, 3).map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) => (isActive ? "studio-explorer-link is-active" : "studio-explorer-link")}
            >
              <item.icon size={14} />
              {item.label}
            </NavLink>
          ))}
        </ExplorerGroup>
        <ExplorerGroup title="Configuration">
          {resourceItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => (isActive ? "studio-explorer-link is-active" : "studio-explorer-link")}
            >
              <item.icon size={14} />
              {item.label}
            </NavLink>
          ))}
        </ExplorerGroup>
      </aside>
      <main className="studio-workbench">
        <div className="studio-editor-tabs">
          <span className="studio-editor-tab is-active">
            <Activity size={14} />
            {activeTitle}
          </span>
        </div>
        <div className="studio-editor-surface">
        <Routes>
          <Route path="/" element={<Workspace />} />
          <Route path="/providers" element={<Configuration />} />
          <Route path="/experts" element={<Configuration />} />
          <Route path="/profiles" element={<Configuration />} />
          <Route path="/presets" element={<Configuration />} />
          <Route path="/settings" element={<Configuration />} />
          <Route path="/settings/:section" element={<Configuration />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/playground" element={<Workspace />} />
          <Route path="/graph" element={<Graph />} />
        </Routes>
        </div>
      </main>
      {!logsFocused && (
        <section className="studio-console-pane" aria-label="Live routing console">
          <div className="studio-console-head">
            <span><PanelBottom size={14} /> Terminal</span>
            <small>Routing events</small>
          </div>
          <RoutingTerminal />
        </section>
      )}
      <footer className="studio-statusbar">
        <span><CircleDot size={11} /> {activeProfile?.name ?? profileSlug}</span>
        <span>{profiles.length} profile{profiles.length === 1 ? "" : "s"}</span>
        <span>OpenGate routing studio</span>
      </footer>
    </div>
  )
}

function ExplorerGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="studio-explorer-group">
      <strong>
        <ChevronRight size={13} />
        {title}
      </strong>
      <div>{children}</div>
    </section>
  )
}
