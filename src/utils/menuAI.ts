import Anthropic from '@anthropic-ai/sdk'

const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string

function getClient(): Anthropic {
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
}

export interface MenuRecommendation {
  dish: string
  description: string
  reason: string
  alternatives: { dish: string; reason: string }[]
}

export async function getMenuRecommendation(
  menuImageBase64: string,
  menuImageType: string,
  preference: string
): Promise<MenuRecommendation> {
  const client = getClient()

  const message = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: menuImageType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: menuImageBase64,
            },
          },
          {
            type: 'text',
            text: `You are a helpful food recommendation assistant. I'm at a restaurant and have taken a photo of the menu.

What I'm in the mood for: "${preference}"

Please analyze the menu in the image and recommend the single best dish for me based on my preference.

Respond ONLY with a valid JSON object in exactly this format (no extra text, no markdown code blocks):
{
  "dish": "Name of the recommended dish",
  "description": "Brief description of the dish from the menu (price if visible)",
  "reason": "Why this dish matches what I'm looking for (1-2 sentences)",
  "alternatives": [
    { "dish": "Alternative dish name", "reason": "Why this is also a good option" },
    { "dish": "Another alternative", "reason": "Why this is also a good option" }
  ]
}`,
          },
        ],
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''

  // Strip markdown code block if present
  const cleaned = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()

  try {
    return JSON.parse(cleaned) as MenuRecommendation
  } catch {
    throw new Error('Could not parse recommendation from AI response. Please try again.')
  }
}
