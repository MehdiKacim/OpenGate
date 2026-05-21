# OpenGate — Database Schema

> Generated from migration `001_initial`.

## Tables

### `settings`
| Column | Type | Notes |
|---|---|---|
| key | TEXT PK | |
| value_json | TEXT NOT NULL | |
| updated_at | TEXT | DEFAULT CURRENT_TIMESTAMP |

### `presets`
| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| name | TEXT NOT NULL | |
| description | TEXT | |
| seed_version | INTEGER NOT NULL | |
| config_json | TEXT NOT NULL | |
| created_at | TEXT | DEFAULT CURRENT_TIMESTAMP |

### `route_profiles`
| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| slug | TEXT NOT NULL UNIQUE | |
| name | TEXT NOT NULL | |
| description | TEXT | |
| source_preset_id | TEXT | FK → presets.id |
| is_default | INTEGER NOT NULL DEFAULT 0 | |
| created_at | TEXT | DEFAULT CURRENT_TIMESTAMP |
| updated_at | TEXT | DEFAULT CURRENT_TIMESTAMP |

### `project_bindings`
| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| route_profile_id | TEXT NOT NULL | FK → route_profiles.id ON DELETE CASCADE |
| project_root | TEXT NOT NULL UNIQUE | |
| project_name | TEXT NOT NULL | |
| marker_path | TEXT NOT NULL | |
| created_at | TEXT | DEFAULT CURRENT_TIMESTAMP |
| updated_at | TEXT | DEFAULT CURRENT_TIMESTAMP |

### `providers`
| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| route_profile_id | TEXT NOT NULL | FK → route_profiles.id ON DELETE CASCADE |
| name | TEXT NOT NULL | |
| type | TEXT NOT NULL | CHECK IN ('oauth','proxy','static') |
| adapter | TEXT | |
| protocol | TEXT NOT NULL DEFAULT 'openai' | |
| base_url | TEXT | |
| auth_type | TEXT | |
| allow_invalid_certificates | INTEGER NOT NULL DEFAULT 0 | |
| enabled | INTEGER NOT NULL DEFAULT 1 | |
| created_at | TEXT | DEFAULT CURRENT_TIMESTAMP |
| updated_at | TEXT | DEFAULT CURRENT_TIMESTAMP |

### `provider_models`
| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| provider_id | TEXT NOT NULL | FK → providers.id ON DELETE CASCADE |
| model_id | TEXT NOT NULL | |
| display_name | TEXT | |
| context_window | INTEGER | |
| enabled | INTEGER NOT NULL DEFAULT 1 | |
| discovered_at | TEXT | |
| created_at | TEXT | DEFAULT CURRENT_TIMESTAMP |
| updated_at | TEXT | DEFAULT CURRENT_TIMESTAMP |

### `experts`
| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| route_profile_id | TEXT NOT NULL | FK → route_profiles.id ON DELETE CASCADE |
| name | TEXT NOT NULL | |
| display_name | TEXT | |
| provider_id | TEXT NOT NULL | FK → providers.id |
| model_id | TEXT NOT NULL | FK → provider_models.id |
| system_prompt | TEXT NOT NULL | |
| temperature | REAL | |
| max_tokens | INTEGER | |
| expose_as_model | INTEGER NOT NULL DEFAULT 1 | |
| enabled | INTEGER NOT NULL DEFAULT 1 | |
| created_at | TEXT | DEFAULT CURRENT_TIMESTAMP |
| updated_at | TEXT | DEFAULT CURRENT_TIMESTAMP |

### `expert_keywords`
| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| expert_id | TEXT NOT NULL | FK → experts.id ON DELETE CASCADE |
| keyword | TEXT NOT NULL | |
| description | TEXT | |
| enabled | INTEGER NOT NULL DEFAULT 1 | |

### `keyword_overrides`
| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| expert_id | TEXT NOT NULL | FK → experts.id ON DELETE CASCADE |
| keyword | TEXT NOT NULL | |
| provider_id | TEXT NOT NULL | FK → providers.id |
| model_id | TEXT NOT NULL | FK → provider_models.id |
| priority | INTEGER NOT NULL DEFAULT 100 | |
| enabled | INTEGER NOT NULL DEFAULT 1 | |

### `requests`
| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| route_profile_id | TEXT NOT NULL | FK → route_profiles.id |
| requested_model | TEXT NOT NULL | |
| final_provider_id | TEXT | |
| final_model_id | TEXT | |
| status | TEXT NOT NULL | |
| started_at | TEXT | DEFAULT CURRENT_TIMESTAMP |
| finished_at | TEXT | |
| latency_ms | INTEGER | |
| prompt_tokens | INTEGER | |
| completion_tokens | INTEGER | |
| total_tokens | INTEGER | |
| error | TEXT | |

### `routing_events`
| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| request_id | TEXT NOT NULL | FK → requests.id ON DELETE CASCADE |
| expert_name | TEXT NOT NULL | |
| detected_keywords_json | TEXT NOT NULL | |
| selected_provider_id | TEXT | |
| selected_model_id | TEXT | |
| override_keyword | TEXT | |
| reason | TEXT NOT NULL | |
| created_at | TEXT | DEFAULT CURRENT_TIMESTAMP |

### `logs`
| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| request_id | TEXT | FK → requests.id ON DELETE SET NULL |
| level | TEXT NOT NULL | |
| service | TEXT NOT NULL | |
| message | TEXT NOT NULL | |
| data_json | TEXT | |
| created_at | TEXT | DEFAULT CURRENT_TIMESTAMP |
