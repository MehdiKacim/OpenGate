export interface RoutingEvent {
  id: string
  requestId: string
  expertName: string
  detectedKeywords: string[]
  selectedProviderId?: string
  selectedModelId?: string
  overrideKeyword?: string
  reason: string
  createdAt: string
}

export interface RoutingDecision {
  expertName: string
  detectedKeywords: string[]
  selectedProviderId: string
  selectedModelId: string
  overrideKeyword?: string
  reason: string
  systemPromptEnrichment?: string
}
