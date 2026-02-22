import { z } from 'zod';
import { insertProjectSchema, insertDialogueSchema, projects, dialogues } from './schema';

// Shared Error Schemas
export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  projects: {
    list: {
      method: 'GET' as const,
      path: '/api/projects' as const,
      responses: {
        200: z.array(z.custom<typeof projects.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/projects/:id' as const,
      responses: {
        200: z.custom<typeof projects.$inferSelect & { dialogues: typeof dialogues.$inferSelect[] }>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/projects' as const,
      input: insertProjectSchema,
      responses: {
        201: z.custom<typeof projects.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/projects/:id' as const,
      input: insertProjectSchema.partial(),
      responses: {
        200: z.custom<typeof projects.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
  },
  dialogues: {
    update: {
      method: 'PUT' as const,
      path: '/api/dialogues/:id' as const,
      input: insertDialogueSchema.partial(),
      responses: {
        200: z.custom<typeof dialogues.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
  },
  ai: {
    generateScript: {
      method: 'POST' as const,
      path: '/api/projects/:id/generate-script' as const,
      input: z.object({ context: z.string().optional() }),
      responses: {
        200: z.array(z.custom<typeof dialogues.$inferSelect>()),
        400: errorSchemas.validation,
      },
    },
    rewriteDialogue: {
      method: 'POST' as const,
      path: '/api/dialogues/:id/rewrite' as const,
      input: z.object({
        instructions: z.string(),
      }),
      responses: {
        200: z.custom<typeof dialogues.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    generateAudio: {
      method: 'POST' as const,
      path: '/api/dialogues/:id/generate-audio' as const,
      input: z.object({}), // Uses dialogue text and project voice settings
      responses: {
        200: z.custom<typeof dialogues.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    generateTranscript: {
      method: 'POST' as const,
      path: '/api/dialogues/:id/generate-transcript' as const,
      input: z.object({}),
      responses: {
        200: z.custom<typeof dialogues.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export type ProjectInput = z.infer<typeof api.projects.create.input>;
export type ProjectUpdateInput = z.infer<typeof api.projects.update.input>;
export type DialogueUpdateInput = z.infer<typeof api.dialogues.update.input>;
