import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(6000),
});

const inputSchema = z.object({
  subject: z.string().max(60).optional(),
  messages: z.array(messageSchema).min(1).max(24),
});

const SYSTEM = `You are Tutor, the built-in study helper inside Lumo — a social progression app for students.
Rules:
- Be genuinely useful for homework and revision: explain step by step, in plain language.
- Never just hand over an answer to an assessment; show the working and the reasoning so the student learns it.
- Keep replies tight: short paragraphs, bullets, and worked examples. Use markdown-free plain text with simple dashes for lists.
- Ask one clarifying question only when the request is truly ambiguous.
- If asked for something off-topic (or to cheat outright), steer back to studying kindly.`;

export const askTutor = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { reply: "", error: "Tutor is not configured yet." };

    const subjectLine = data.subject
      ? `\nThe student is currently studying: ${data.subject}. Bias examples toward that subject.`
      : "";

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-5.6-sol",
          input: [
            { role: "system", content: SYSTEM + subjectLine },
            ...data.messages.map((m) => ({ role: m.role, content: m.content })),
          ],
          max_output_tokens: 1200,
        }),
      });

      if (!res.ok) {
        const detail = await res.text();
        console.error("tutor gateway error", res.status, detail.slice(0, 500));
        if (res.status === 429) return { reply: "", error: "Tutor is busy right now — try again in a moment." };
        return { reply: "", error: "Tutor could not answer that. Try again." };
      }

      const json = (await res.json()) as {
        output_text?: string;
        output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
      };

      const reply =
        json.output_text?.trim() ||
        (json.output ?? [])
          .flatMap((item) => item.content ?? [])
          .filter((c) => c.type === "output_text" && c.text)
          .map((c) => c.text as string)
          .join("\n")
          .trim();

      if (!reply) return { reply: "", error: "Tutor came back empty. Try rephrasing." };
      return { reply, error: null as string | null };
    } catch (err) {
      console.error("tutor request failed", err);
      return { reply: "", error: "Tutor is unreachable right now." };
    }
  });
