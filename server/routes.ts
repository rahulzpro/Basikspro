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

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

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

  app.post(api.ai.generateScript.path, async (req, res) => {
    try {
      const projectId = Number(req.params.id);
      const project = await storage.getProject(projectId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const prompt = `Generate a ${project.duration} debate script on the topic: "${project.topic}". 
      The debate is between ${project.speakerAName} (Speaker A) and ${project.speakerBName} (Speaker B).
      Output the script in a valid JSON array format where each element is an object with 'speaker' ('A' or 'B') and 'text'.
      Do not include any markdown formatting like \`\`\`json, just output the raw JSON array.
      Keep it engaging and argumentative.`;

      const response = await ai.models.generateContent({
        model: project.model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });

      const jsonText = response.text || "[]";
      let scriptParsed;
      try {
        scriptParsed = JSON.parse(jsonText);
      } catch (e) {
        const cleaned = jsonText.replace(/^```json\n/, '').replace(/\n```$/, '');
        scriptParsed = JSON.parse(cleaned);
      }

      await storage.deleteDialogues(projectId);
      const toInsert = scriptParsed.map((d: any, index: number) => ({
        projectId,
        sequence: index,
        speaker: d.speaker === 'A' ? 'A' : 'B',
        text: d.text
      }));

      const newDialogues = await storage.insertDialogues(toInsert);
      res.json(newDialogues);

    } catch (err) {
      console.error(err);
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
      
      const prompt = `Rewrite the following dialogue for a debate. 
      Original text: "${dbDialogue.text}"
      Speaker: ${dbDialogue.speaker === 'A' ? project?.speakerAName : project?.speakerBName}
      Instructions: ${instructions}
      Just output the rewritten text and nothing else.`;

      const response = await ai.models.generateContent({
        model: project?.model || "gemini-3.1-pro-preview",
        contents: prompt,
      });

      const updated = await storage.updateDialogue(dialogueId, { text: response.text || dbDialogue.text });
      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to rewrite" });
    }
  });

  app.post(api.ai.generateAudio.path, async (req, res) => {
    try {
      const dialogueId = Number(req.params.id);
      const dbDialogue = await storage.getDialogue(dialogueId);
      if (!dbDialogue) return res.status(404).json({ message: "Dialogue not found" });

      const project = await storage.getProject(dbDialogue.projectId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const voice = dbDialogue.speaker === 'A' ? project.speakerAVoice : project.speakerBVoice;
      
      // Using Gemini 2.5 Flash for audio generation (Google TTS 2.5 equivalent in Replit AI)
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Convert this text to speech with a natural debate tone: "${dbDialogue.text}"`,
        config: {
          responseModalities: ["text", "audio"],
        }
      });

      const candidate = response.candidates?.[0];
      const audioPart = candidate?.content?.parts?.find((part: any) => part.inlineData);

      if (!audioPart?.inlineData?.data) {
        // Fallback to OpenAI TTS if Gemini audio fails or is not supported for this specific model variant
        const audioResponse = await openai.audio.speech.create({
          model: "tts-1",
          voice: voice as any,
          input: dbDialogue.text,
          response_format: "mp3"
        });
        const buffer = Buffer.from(await audioResponse.arrayBuffer());
        const base64 = buffer.toString('base64');
        const dataUrl = `data:audio/mp3;base64,${base64}`;
        const updated = await storage.updateDialogue(dialogueId, { audioUrl: dataUrl });
        return res.json(updated);
      }

      const mimeType = audioPart.inlineData.mimeType || "audio/mp3";
      const dataUrl = `data:${mimeType};base64,${audioPart.inlineData.data}`;

      const updated = await storage.updateDialogue(dialogueId, { audioUrl: dataUrl });
      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to generate audio" });
    }
  });

  return httpServer;
}
