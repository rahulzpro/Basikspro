import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

// OpenAI is optional — only used as fallback
let openai: OpenAI | null = null;
try {
  if (process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY) {
    openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
} catch { /* OpenAI not configured */ }

// ─── Audio generation helpers ────────────────────────────────────────────────

async function generateOpenAIAudio(text: string, voice: string): Promise<string> {
  if (!openai) throw new Error("OpenAI is not configured — set OPENAI_API_KEY env var");
  const audioResponse = await openai.audio.speech.create({
    model: "tts-1",
    voice: voice as any,
    input: text,
    response_format: "mp3",
  });
  const buffer = Buffer.from(await audioResponse.arrayBuffer());
  const base64 = buffer.toString("base64");
  return `data:audio/mp3;base64,${base64}`;
}

async function generateElevenLabsAudio(text: string, voiceId: string): Promise<string> {
  const apiKey = process.env.ELEVENLABS_API_KEY || process.env.AI_INTEGRATIONS_ELEVENLABS_API_KEY || "";
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_turbo_v2_5",
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });
  if (!response.ok) throw new Error(`ElevenLabs error: ${response.status} ${await response.text()}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const base64 = buffer.toString("base64");
  return `data:audio/mpeg;base64,${base64}`;
}

async function generateGeminiTTSAudio(text: string, voiceName: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: text,
    config: {
      responseModalities: ["AUDIO"] as any,
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      } as any,
    },
  });
  const candidate = response.candidates?.[0];
  const audioPart = candidate?.content?.parts?.find((p: any) => p.inlineData);
  if (!audioPart?.inlineData?.data) throw new Error("Gemini TTS returned no audio data");
  const mimeType = audioPart.inlineData.mimeType || "audio/mp3";
  return `data:${mimeType};base64,${audioPart.inlineData.data}`;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get(api.projects.list.path, async (req, res) => {
    const projects = await storage.getProjects();
    res.json(projects);
  });

  app.get(api.projects.get.path, async (req, res) => {
    const project = await storage.getProject(Number(req.params.id));
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    const dialogs = await storage.getDialogues(project.id);
    res.json({ ...project, dialogues: dialogs });
  });

  app.post(api.projects.create.path, async (req, res) => {
    try {
      const input = api.projects.create.input.parse(req.body);
      const project = await storage.createProject(input);
      res.status(201).json(project);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.put(api.projects.update.path, async (req, res) => {
    try {
      const input = api.projects.update.input.parse(req.body);
      const project = await storage.updateProject(Number(req.params.id), input);
      res.json(project);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
        });
      }
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.put(api.dialogues.update.path, async (req, res) => {
    try {
      const input = api.dialogues.update.input.parse(req.body);
      const dialogue = await storage.updateDialogue(Number(req.params.id), input);
      res.json(dialogue);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
        });
      }
      res.status(500).json({ message: "Internal error" });
    }
  });

  // Generate script with narrator support
  app.post(api.ai.generateScript.path, async (req, res) => {
    try {
      const projectId = Number(req.params.id);
      const project = await storage.getProject(projectId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const { context } = req.body as { context?: string };

      // Map numeric duration (minutes) to number of argument rounds
      const durationMins = parseInt(project.duration) || 7;
      let rounds: number;
      if (durationMins <= 1) rounds = 1;
      else if (durationMins <= 5) rounds = 3;
      else if (durationMins <= 8) rounds = 4;
      else if (durationMins <= 15) rounds = 6;
      else if (durationMins <= 20) rounds = 8;
      else if (durationMins <= 25) rounds = 10;
      else if (durationMins <= 30) rounds = 12;
      else rounds = 15;

      const narratorName = project.speakerNarratorName || "Narrator";
      const contextSection = context ? `\n\nReference Context:\n${context.slice(0, 3000)}\nUse this context to inform the debate content.\n` : "";

      const prompt = `Generate a ${durationMins}-minute debate script on the topic: "${project.topic}".${contextSection}
The debate has three participants:
- ${project.speakerAName} (Speaker A) - argues FOR the topic
- ${project.speakerBName} (Speaker B) - argues AGAINST the topic
- ${narratorName} (Narrator N) - introduces each round with a brief context sentence

Structure each debate round as:
1. Narrator N: A short 1-2 sentence intro for the upcoming argument point
2. Speaker A: Their argument (3-6 sentences, substantive and detailed)
3. Speaker B: Their counter-argument (3-6 sentences, substantive and detailed)

Generate exactly ${rounds} such rounds.

Output ONLY a valid JSON array where each element has 'speaker' ('A', 'B', or 'N') and 'text'.
Example: [{"speaker":"N","text":"..."},{"speaker":"A","text":"..."},{"speaker":"B","text":"..."}]
Do NOT include any markdown formatting. Just the raw JSON array.`;

      const response = await ai.models.generateContent({
        model: project.model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      const jsonText = response.text || "[]";
      let scriptParsed: any[];
      try {
        scriptParsed = JSON.parse(jsonText);
      } catch {
        const cleaned = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        scriptParsed = JSON.parse(cleaned);
      }

      await storage.deleteDialogues(projectId);
      const toInsert = scriptParsed.map((d: any, index: number) => ({
        projectId,
        sequence: index,
        speaker: ['A', 'B', 'N'].includes(d.speaker) ? d.speaker : 'A',
        text: d.text,
      }));

      const newDialogues = await storage.insertDialogues(toInsert);
      res.json(newDialogues);
    } catch (err) {
      console.error("generateScript error:", err);
      res.status(500).json({ message: "Failed to generate script" });
    }
  });

  app.post(api.ai.rewriteDialogue.path, async (req, res) => {
    try {
      const dialogueId = Number(req.params.id);
      const { instructions } = api.ai.rewriteDialogue.input.parse(req.body);

      const dbDialogue = await storage.getDialogue(dialogueId);
      if (!dbDialogue) return res.status(404).json({ message: "Dialogue not found" });

      const project = await storage.getProject(dbDialogue.projectId);
      const speakerLabel =
        dbDialogue.speaker === 'A' ? project?.speakerAName :
        dbDialogue.speaker === 'B' ? project?.speakerBName :
        project?.speakerNarratorName || 'Narrator';

      const prompt = `Rewrite the following dialogue for a debate.
Original text: "${dbDialogue.text}"
Speaker: ${speakerLabel}
Instructions: ${instructions}
Just output the rewritten text and nothing else.`;

      const response = await ai.models.generateContent({
        model: project?.model || "gemini-2.0-flash",
        contents: prompt,
      });

      const updated = await storage.updateDialogue(dialogueId, { text: response.text || dbDialogue.text });
      res.json(updated);
    } catch (err) {
      console.error("rewriteDialogue error:", err);
      res.status(500).json({ message: "Failed to rewrite" });
    }
  });

  // Generate audio with multi-provider support
  app.post(api.ai.generateAudio.path, async (req, res) => {
    try {
      const dialogueId = Number(req.params.id);
      const dbDialogue = await storage.getDialogue(dialogueId);
      if (!dbDialogue) return res.status(404).json({ message: "Dialogue not found" });

      const project = await storage.getProject(dbDialogue.projectId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      // Pick voice based on speaker
      const voice =
        dbDialogue.speaker === 'A' ? project.speakerAVoice :
        dbDialogue.speaker === 'B' ? project.speakerBVoice :
        project.speakerNarratorVoice || 'shimmer';

      const provider = project.audioProvider || 'openai';
      let dataUrl: string;

      try {
        if (provider === 'elevenlabs') {
          dataUrl = await generateElevenLabsAudio(dbDialogue.text, voice);
        } else if (provider === 'gemini') {
          dataUrl = await generateGeminiTTSAudio(dbDialogue.text, voice);
        } else {
          // openai (default)
          dataUrl = await generateOpenAIAudio(dbDialogue.text, voice);
        }
      } catch (providerErr: any) {
        console.warn(`${provider} audio failed:`, providerErr?.message);
        // Fallback to Gemini TTS if primary provider fails
        if (provider !== 'gemini') {
          const fallbackVoice = dbDialogue.speaker === 'A' ? 'Kore' : dbDialogue.speaker === 'B' ? 'Charon' : 'Aoede';
          dataUrl = await generateGeminiTTSAudio(dbDialogue.text, fallbackVoice);
        } else if (openai) {
          const fallbackVoice = dbDialogue.speaker === 'A' ? 'alloy' : dbDialogue.speaker === 'B' ? 'echo' : 'shimmer';
          dataUrl = await generateOpenAIAudio(dbDialogue.text, fallbackVoice);
        } else {
          throw providerErr;
        }
      }

      const updated = await storage.updateDialogue(dialogueId, { audioUrl: dataUrl });
      res.json(updated);
    } catch (err) {
      console.error("generateAudio error:", err);
      res.status(500).json({ message: "Failed to generate audio" });
    }
  });

  // Generate transcript from audio using Gemini Flash multimodal
  app.post(api.ai.generateTranscript.path, async (req, res) => {
    try {
      const dialogueId = Number(req.params.id);
      const dbDialogue = await storage.getDialogue(dialogueId);
      if (!dbDialogue) return res.status(404).json({ message: "Dialogue not found" });

      if (!dbDialogue.audioUrl) {
        return res.status(400).json({ message: "No audio to transcribe. Generate audio first." });
      }

      // Extract base64 data and mime type from data URL
      const match = dbDialogue.audioUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) {
        return res.status(400).json({ message: "Invalid audio data format" });
      }
      const [, mimeType, base64Data] = match;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              } as any,
              {
                text: "Transcribe this audio exactly word for word. Output only the transcription text, nothing else.",
              },
            ],
          },
        ],
      });

      const transcript = response.text?.trim() || dbDialogue.text;
      const updated = await storage.updateDialogue(dialogueId, { transcript });
      res.json(updated);
    } catch (err) {
      console.error("generateTranscript error:", err);
      res.status(500).json({ message: "Failed to generate transcript" });
    }
  });

  return httpServer;
}
