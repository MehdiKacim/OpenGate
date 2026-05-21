export interface SettingsTable {
  key: string
  value_json: string
  updated_at: string
}

export interface PresetsTable {
  id: string
  name: string
  description: string | null
  seed_version: number
  config_json: string
  created_at: string
}

export interface RouteProfilesTable {
  id: string
  slug: string
  name: string
  description: string | null
  source_preset_id: string | null
  is_default: number
  created_at: string
  updated_at: string
}

export interface ProjectBindingsTable {
  id: string
  route_profile_id: string
  project_root: string
  project_name: string
  marker_path: string
  created_at: string
  updated_at: string
}

export interface ProvidersTable {
  id: string
  route_profile_id: string
  name: string
  type: 'oauth' | 'proxy' | 'static'
  adapter: string | null
  protocol: string
  base_url: string | null
  auth_type: string | null
  allow_invalid_certificates: number
  enabled: number
  created_at: string
  updated_at: string
}

export interface ProviderModelsTable {
  id: string
  provider_id: string
  model_id: string
  display_name: string | null
  context_window: number | null
  enabled: number
  discovered_at: string | null
  created_at: string
  updated_at: string
}

export interface ExpertsTable {
  id: string
  route_profile_id: string
  name: string
  display_name: string | null
  provider_id: string
  model_id: string
  system_prompt: string
  temperature: number | null
  max_tokens: number | null
  expose_as_model: number
  enabled: number
  created_at: string
  updated_at: string
}

export interface ExpertKeywordsTable {
  id: string
  expert_id: string
  keyword: string
  description: string | null
  enabled: number
}

export interface KeywordOverridesTable {
  id: string
  expert_id: string
  keyword: string
  provider_id: string
  model_id: string
  priority: number
  enabled: number
}

export interface RequestsTable {
  id: string
  route_profile_id: string
  requested_model: string
  final_provider_id: string | null
  final_model_id: string | null
  status: string
  started_at: string
  finished_at: string | null
  latency_ms: number | null
  prompt_tokens: number | null
  completion_tokens: number | null
  total_tokens: number | null
  error: string | null
}

export interface RoutingEventsTable {
  id: string
  request_id: string
  expert_name: string
  detected_keywords_json: string
  selected_provider_id: string | null
  selected_model_id: string | null
  override_keyword: string | null
  reason: string
  created_at: string
}

export interface LogsTable {
  id: string
  request_id: string | null
  level: string
  service: string
  message: string
  data_json: string | null
  created_at: string
}

export interface Database {
  settings: SettingsTable
  presets: PresetsTable
  route_profiles: RouteProfilesTable
  project_bindings: ProjectBindingsTable
  providers: ProvidersTable
  provider_models: ProviderModelsTable
  experts: ExpertsTable
  expert_keywords: ExpertKeywordsTable
  keyword_overrides: KeywordOverridesTable
  requests: RequestsTable
  routing_events: RoutingEventsTable
  logs: LogsTable
}
