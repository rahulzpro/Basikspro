import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Video, Clock, ChevronRight, Activity, Sparkles,
  Mic, FileText, Play, Trash2, MoreHorizontal, Zap, Users
} from "lucide-react";
import { useProjects, useCreateProject } from "@/hooks/use-projects";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

const FEATURES = [
  { icon: FileText, title: "AI Script", desc: "Auto-generate debate scripts with narrator" },
  { icon: Mic, title: "Voice Synthesis", desc: "Gemini TTS & ElevenLabs voices" },
  { icon: Video, title: "6 Visual Styles", desc: "Panel, Bar, News, Arena, Split, Podcast" },
  { icon: Zap, title: "Live Preview", desc: "Real-time playback with score cards" },
];

export default function Dashboard() {
  const [_, setLocation] = useLocation();
  const { data: projects, isLoading } = useProjects();
  const createProject = useCreateProject();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateNew = async () => {
    setIsCreating(true);
    try {
      const newProject = await createProject.mutateAsync({
        topic: "Untitled Debate",
        duration: "medium",
        model: "gemini-3-flash-preview",
        speakerAName: "Speaker A",
        speakerBName: "Speaker B",
        speakerAVoice: "alloy",
        speakerBVoice: "echo",
        backgroundImage: null,
      });
      setLocation(`/projects/${newProject.id}?step=1`);
    } catch (error) {
      console.error(error);
      setIsCreating(false);
    }
  };

  const hasProjects = projects && projects.length > 0;

  return (
    <div className="min-h-screen">
      {/* ─── HERO / HEADER ─── */}
      <div className="relative overflow-hidden">
        {/* Animated gradient orbs */}
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-primary/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute -top-20 right-0 w-60 h-60 bg-cyan-500/15 rounded-full blur-[100px]" style={{ animationDelay: "1s" }} />

        <div className="relative z-10 pt-12 pb-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          {/* Brand */}
          <div className="flex items-center gap-2.5 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-display font-black text-white tracking-tight leading-none">BasiksPro</h1>
              <p className="text-[10px] text-primary font-bold tracking-widest uppercase">AI Debate Studio</p>
            </div>
          </div>

          {/* Hero content */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-6">
            <div>
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-3xl sm:text-4xl lg:text-5xl font-display font-black text-white leading-tight mb-3"
              >
                {hasProjects ? "Your Projects" : "Create AI Debates"}
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-muted-foreground text-base lg:text-lg max-w-lg"
              >
                {hasProjects
                  ? `${projects.length} project${projects.length > 1 ? "s" : ""} — click to continue editing`
                  : "Generate scripts, synthesize voices, and preview debate videos with AI scoring."}
              </motion.p>
            </div>
            <motion.button
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              onClick={handleCreateNew}
              disabled={isCreating}
              className="group relative inline-flex items-center justify-center px-8 py-3.5 text-base font-bold text-white transition-all duration-200 bg-gradient-to-r from-primary to-indigo-600 rounded-xl hover:shadow-[0_0_30px_rgba(124,58,237,0.5)] disabled:opacity-50 shrink-0"
            >
              {isCreating ? (
                <LoadingSpinner size={20} className="text-white mr-2" />
              ) : (
                <Plus className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform duration-300" />
              )}
              New Debate Video
            </motion.button>
          </div>

          {/* Feature pills — show when no projects */}
          {!hasProjects && !isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6"
            >
              {FEATURES.map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 + i * 0.08 }}
                  className="glass-panel rounded-xl p-4 flex flex-col gap-2 group hover:border-primary/30 transition-all"
                >
                  <f.icon className="w-5 h-5 text-primary" />
                  <span className="text-white text-sm font-bold">{f.title}</span>
                  <span className="text-gray-500 text-xs leading-snug">{f.desc}</span>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </div>

      {/* ─── CONTENT ─── */}
      <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto pb-16">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <LoadingSpinner size={48} />
          </div>
        ) : !hasProjects ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="glass-panel rounded-3xl p-10 sm:p-16 text-center flex flex-col items-center justify-center mt-6"
          >
            <div className="w-20 h-20 bg-gradient-to-br from-primary/20 to-indigo-600/20 rounded-full flex items-center justify-center mb-6 ring-2 ring-primary/10 ring-offset-4 ring-offset-transparent">
              <Video className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-2xl font-display font-bold text-white mb-2">Start Your First Debate</h3>
            <p className="text-muted-foreground mb-8 max-w-md text-sm leading-relaxed">
              Set a topic, generate an AI script with narrator intros, add Gemini or ElevenLabs voices, then preview with 6 different visual styles.
            </p>
            <button
              onClick={handleCreateNew}
              disabled={isCreating}
              className="px-7 py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-100 transition-colors flex items-center gap-2"
            >
              {isCreating ? <LoadingSpinner size={18} /> : <Play className="w-4 h-4" />}
              Create Project
            </button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-2">
            {projects?.map((project, idx) => {
              const durationLabel = isNaN(Number(project.duration)) ? project.duration : `${project.duration} min`;
              return (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => setLocation(`/projects/${project.id}?step=1`)}
                  className="glass-panel group cursor-pointer rounded-2xl overflow-hidden hover:-translate-y-1 hover:border-primary/30 transition-all duration-300 relative"
                >
                  {/* Top accent gradient */}
                  <div className="h-1 bg-gradient-to-r from-primary via-indigo-500 to-cyan-500 opacity-60 group-hover:opacity-100 transition-opacity" />

                  <div className="p-5">
                    <div className="flex justify-between items-start mb-3">
                      <div className="p-2.5 bg-primary/10 rounded-lg border border-primary/20">
                        <Video className="w-5 h-5 text-primary" />
                      </div>
                      <span className="flex items-center text-[10px] font-medium px-2 py-0.5 bg-white/5 border border-white/10 rounded-full text-gray-500">
                        <Clock className="w-3 h-3 mr-1" />
                        {new Date(project.createdAt || "").toLocaleDateString()}
                      </span>
                    </div>

                    <h3 className="text-lg font-display font-bold text-white mb-1.5 group-hover:text-primary transition-colors line-clamp-1">
                      {project.topic === "Untitled Debate" ? "Draft Project" : project.topic}
                    </h3>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-5">
                      <span className="flex items-center gap-1 bg-white/5 rounded-md px-2 py-0.5">
                        <Clock className="w-3 h-3" /> {durationLabel}
                      </span>
                      <span className="flex items-center gap-1 bg-white/5 rounded-md px-2 py-0.5">
                        <Zap className="w-3 h-3" /> {project.model.includes("pro") ? "Pro" : "Flash"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-white/5">
                      <div className="flex items-center gap-1.5">
                        <div className="flex items-center gap-1">
                          <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] font-bold ring-1 ring-indigo-500/30">{project.speakerAName.charAt(0)}</span>
                          <span className="text-gray-600 text-[10px] font-bold">VS</span>
                          <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[10px] font-bold ring-1 ring-cyan-500/30">{project.speakerBName.charAt(0)}</span>
                        </div>
                        <span className="text-gray-600 text-[10px] ml-1 hidden sm:inline">{project.speakerAName} vs {project.speakerBName}</span>
                      </div>
                      <div className="flex items-center gap-1 text-gray-500 group-hover:text-primary transition-colors">
                        <span className="text-[10px] font-bold hidden sm:inline">Open</span>
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
