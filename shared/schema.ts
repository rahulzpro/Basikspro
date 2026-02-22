import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TABLE DEFINITIONS ===
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  topic: text("topic").notNull(),
  duration: text("duration").notNull(), // short, medium, long
  model: text("model").notNull(), // gemini-3-flash-preview, gemini-3.1-pro-preview
  speakerAName: text("speaker_a_name").notNull().default("Speaker A"),
  speakerBName: text("speaker_b_name").notNull().default("Speaker B"),
  speakerAVoice: text("speaker_a_voice").notNull().default("alloy"),
  speakerBVoice: text("speaker_b_voice").notNull().default("echo"),
  backgroundImage: text("background_image"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const dialogues = pgTable("dialogues", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  sequence: integer("sequence").notNull(),
  speaker: text("speaker").notNull(), // 'A' or 'B'
  text: text("text").notNull(),
  audioUrl: text("audio_url"),
});

// === RELATIONS ===
export const projectsRelations = relations(projects, ({ many }) => ({
  dialogues: many(dialogues),
}));

export const dialoguesRelations = relations(dialogues, ({ one }) => ({
  project: one(projects, {
    fields: [dialogues.projectId],
    references: [projects.id],
  }),
}));

// === BASE SCHEMAS ===
export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, createdAt: true });
export const insertDialogueSchema = createInsertSchema(dialogues).omit({ id: true });

// === EXPLICIT API CONTRACT TYPES ===

// Base types
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Dialogue = typeof dialogues.$inferSelect;
export type InsertDialogue = z.infer<typeof insertDialogueSchema>;

// Request types
export type CreateProjectRequest = InsertProject;
export type UpdateProjectRequest = Partial<InsertProject>;
export type UpdateDialogueRequest = Partial<InsertDialogue>;

export type GenerateScriptRequest = {
  topic: string;
  duration: string;
  model: string;
};

export type RewriteDialogueRequest = {
  text: string;
  instructions: string;
  model: string;
};

// Response types
export type ProjectResponse = Project & { dialogues: Dialogue[] };
export type ProjectsListResponse = Project[];
export type DialogueResponse = Dialogue;
export type AudioGenerationResponse = { audioUrl: string };

