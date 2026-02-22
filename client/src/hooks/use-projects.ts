import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type ProjectInput, type ProjectUpdateInput, type DialogueUpdateInput } from "@shared/routes";

// --- Queries ---

export function useProjects() {
  return useQuery({
    queryKey: [api.projects.list.path],
    queryFn: async () => {
      const res = await fetch(api.projects.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch projects");
      return api.projects.list.responses[200].parse(await res.json());
    },
  });
}

export function useProject(id: number) {
  return useQuery({
    queryKey: [api.projects.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.projects.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch project");
      return api.projects.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

// --- Mutations ---

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: ProjectInput) => {
      const validated = api.projects.create.input.parse(data);
      const res = await fetch(api.projects.create.path, {
        method: api.projects.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create project");
      return api.projects.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.projects.list.path] });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & ProjectUpdateInput) => {
      const validated = api.projects.update.input.parse(updates);
      const url = buildUrl(api.projects.update.path, { id });
      const res = await fetch(url, {
        method: api.projects.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update project");
      return api.projects.update.responses[200].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.projects.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.projects.get.path, variables.id] });
    },
  });
}

export function useUpdateDialogue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId, ...updates }: { id: number, projectId: number } & DialogueUpdateInput) => {
      const validated = api.dialogues.update.input.parse(updates);
      const url = buildUrl(api.dialogues.update.path, { id });
      const res = await fetch(url, {
        method: api.dialogues.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update dialogue");
      return api.dialogues.update.responses[200].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.projects.get.path, variables.projectId] });
    },
  });
}

export function useGenerateScript() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, context }: { projectId: number; context?: string }) => {
      const url = buildUrl(api.ai.generateScript.path, { id: projectId });
      const res = await fetch(url, {
        method: api.ai.generateScript.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to generate script");
      return api.ai.generateScript.responses[200].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.projects.get.path, variables.projectId] });
    },
  });
}

export function useRewriteDialogue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ dialogueId, projectId, instructions }: { dialogueId: number, projectId: number, instructions: string }) => {
      const url = buildUrl(api.ai.rewriteDialogue.path, { id: dialogueId });
      const res = await fetch(url, {
        method: api.ai.rewriteDialogue.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instructions }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to rewrite dialogue");
      return api.ai.rewriteDialogue.responses[200].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.projects.get.path, variables.projectId] });
    },
  });
}

export function useGenerateAudio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ dialogueId, projectId }: { dialogueId: number, projectId: number }) => {
      const url = buildUrl(api.ai.generateAudio.path, { id: dialogueId });
      const res = await fetch(url, {
        method: api.ai.generateAudio.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to generate audio");
      return api.ai.generateAudio.responses[200].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.projects.get.path, variables.projectId] });
    },
  });
}

export function useGenerateTranscript() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ dialogueId, projectId }: { dialogueId: number, projectId: number }) => {
      const url = buildUrl(api.ai.generateTranscript.path, { id: dialogueId });
      const res = await fetch(url, {
        method: api.ai.generateTranscript.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to generate transcript");
      return api.ai.generateTranscript.responses[200].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.projects.get.path, variables.projectId] });
    },
  });
}
