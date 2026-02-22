import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TABLE DEFINITIONS ===
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  topic: text("topic").notNull(),
  duration: text("duration").notNull(),
  model: text("model").notNull(),
  speakerAName: text("speaker_a_name").notNull().default("Speaker A"),
  speakerBName: text("speaker_b_name").notNull().default("Speaker B"),
  speakerNarratorName: text("speaker_narrator_name").notNull().default("Narrator"),
  speakerAVoice: text("speaker_a_voice").notNull().default("alloy"),
  speakerBVoice: text("speaker_b_voice").notNull().default("echo"),
  speakerNarratorVoice: text("speaker_narrator_voice").notNull().default("shimmer"),
  audioProvider: text("audio_provider").notNull().default("openai"),
  backgroundImage: text("background_image"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const dialogues = pgTable("dialogues", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  sequence: integer("sequence").notNull(),
  speaker: text("speaker").notNull(), // 'A', 'B', or 'N' (narrator)
  text: text("text").notNull(),
  audioUrl: text("audio_url"),
  transcript: text("transcript"), // Gemini-generated transcript from audio
});

// === RELATIONS ===
export const projectsRelations = relations(projects, ({ many }) => ({
  dialogues: many(dialogues),
}));
export const dialoguesRelations = relations(dialogues, ({ one }) => ({
  project: one(projects, { fields: [dialogues.projectId], references: [projects.id] }),
}));

// === SCHEMAS ===
export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, createdAt: true });
export const insertDialogueSchema = createInsertSchema(dialogues).omit({ id: true });

// === TYPES ===
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Dialogue = typeof dialogues.$inferSelect;
export type InsertDialogue = z.infer<typeof insertDialogueSchema>;
export type CreateProjectRequest = InsertProject;
export type UpdateProjectRequest = Partial<InsertProject>;
export type UpdateDialogueRequest = Partial<InsertDialogue>;
export type GenerateScriptRequest = { topic: string; duration: string; model: string; };
export type RewriteDialogueRequest = { text: string; instructions: string; model: string; };
export type ProjectResponse = Project & { dialogues: Dialogue[] };
export type ProjectsListResponse = Project[];
export type DialogueResponse = Dialogue;
export type AudioGenerationResponse = { audioUrl: string };
