import { useMemo, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { SelectButton } from "primereact/selectbutton"
import Experts from "./Experts.js"
import Presets from "./Presets.js"
import Providers from "./Providers.js"
import RouteProfiles from "./RouteProfiles.js"

const sections = [
  { label: "Providers", value: "providers" },
  { label: "Experts", value: "experts" },
  { label: "Profiles", value: "profiles" },
  { label: "Presets", value: "presets" },
]

export default function Configuration() {
  const navigate = useNavigate()
  const location = useLocation()
  const selected = useMemo(() => {
    const settingsSection = location.pathname.split("/")[2]
    if (settingsSection) return settingsSection
    if (location.pathname === "/experts") return "experts"
    if (location.pathname === "/profiles") return "profiles"
    if (location.pathname === "/presets") return "presets"
    return "providers"
  }, [location.pathname])
  const [section, setSection] = useState(selected)
  const activeSection = selected || section

  return (
    <div className="configuration-page">
      <header className="configuration-toolbar">
        <strong>Workspace settings</strong>
        <SelectButton
          value={activeSection}
          options={sections}
          onChange={(event) => {
            const value = event.value || "providers"
            setSection(value)
            navigate(`/settings/${value}`)
          }}
        />
      </header>
      {activeSection === "providers" && <Providers />}
      {activeSection === "experts" && <Experts />}
      {activeSection === "profiles" && <RouteProfiles />}
      {activeSection === "presets" && <Presets />}
    </div>
  )
}
