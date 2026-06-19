import { convertToModelMessages, streamText, type UIMessage } from "ai"

export const maxDuration = 30

export async function POST(req: Request) {
  const {
    messages,
    context,
  }: { messages: UIMessage[]; context?: string } = await req.json()

  const system = `You are Marcel's personal AI fitness and health coach inside a tracking app.
You give concise, practical, encouraging advice on workouts, nutrition, sleep, recovery, and body composition.

Guidelines:
- Be specific and actionable. Prefer short paragraphs and bullet lists.
- Reference the user's actual data below when relevant.
- Never give medical diagnoses; suggest consulting a professional for medical concerns.
- Keep responses focused and friendly, not overly long.

Here is the user's current data snapshot (may be empty):
${context ?? "No data provided."}`

  const result = streamText({
    model: "google/gemini-3.5-flash",
    system,
    messages: await convertToModelMessages(messages),
  })

  return result.toUIMessageStreamResponse()
}
