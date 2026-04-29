import OpenAI from 'openai'

let _client: OpenAI | null = null

export function getOpenAI(): OpenAI {
  if (!_client) {
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return _client
}

export const MODELS = {
  quality: 'gpt-4o',
  fast:    'gpt-4o-mini',
  smart:   'gpt-4o',       // for film briefs — quality matters here
} as const
