import { db } from "./db";
import {
  projects,
  dialogues,
  type Project,
  type InsertProject,
  type UpdateProjectRequest,
  type Dialogue,
  type InsertDialogue,
  type UpdateDialogueRequest,
} from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  getProjects(): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, updates: UpdateProjectRequest): Promise<Project>;
  
  getDialogues(projectId: number): Promise<Dialogue[]>;
  getDialogue(id: number): Promise<Dialogue | undefined>;
  createDialogue(dialogue: InsertDialogue): Promise<Dialogue>;
  updateDialogue(id: number, updates: UpdateDialogueRequest): Promise<Dialogue>;
  deleteDialogues(projectId: number): Promise<void>;
  insertDialogues(dialoguesToInsert: InsertDialogue[]): Promise<Dialogue[]>;
}

export class DatabaseStorage implements IStorage {
  async getProjects(): Promise<Project[]> {
    return await db.select().from(projects);
  }

  async getProject(id: number): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }

  async createProject(project: InsertProject): Promise<Project> {
    const [created] = await db.insert(projects).values(project).returning();
    return created;
  }

  async updateProject(id: number, updates: UpdateProjectRequest): Promise<Project> {
    const [updated] = await db.update(projects)
      .set(updates)
      .where(eq(projects.id, id))
      .returning();
    return updated;
  }

  async getDialogues(projectId: number): Promise<Dialogue[]> {
    return await db.select().from(dialogues).where(eq(dialogues.projectId, projectId)).orderBy(dialogues.sequence);
  }

  async getDialogue(id: number): Promise<Dialogue | undefined> {
    const [dialogue] = await db.select().from(dialogues).where(eq(dialogues.id, id));
    return dialogue;
  }

  async createDialogue(dialogue: InsertDialogue): Promise<Dialogue> {
    const [created] = await db.insert(dialogues).values(dialogue).returning();
    return created;
  }

  async updateDialogue(id: number, updates: UpdateDialogueRequest): Promise<Dialogue> {
    const [updated] = await db.update(dialogues)
      .set(updates)
      .where(eq(dialogues.id, id))
      .returning();
    return updated;
  }

  async deleteDialogues(projectId: number): Promise<void> {
    await db.delete(dialogues).where(eq(dialogues.projectId, projectId));
  }

  async insertDialogues(dialoguesToInsert: InsertDialogue[]): Promise<Dialogue[]> {
    return await db.insert(dialogues).values(dialoguesToInsert).returning();
  }
}

export const storage = new DatabaseStorage();
