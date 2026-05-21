import pino from "pino"

export function createLogger(service: string) {
  return pino({
    name: service,
    level: process.env.OPENGATE_LOG_LEVEL || "info",
  })
}
