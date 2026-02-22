import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Plus, Video, Clock, ChevronRight, Activity } from "lucide-react";
import { useProjects, useCreateProject } from "@/hooks/use-projects";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export default function Dashboard() {
  const [_, setLocation] = useLocation();
  const { data: projects, isLoading } = useProjects();
  const createProject = useCreateProject();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateNew = async () => {
    setIsCreating(true);
    try {
      // Create a draft project to start the wizard
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

  return (
    <div className="min-h-screen pt-20 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold text-gradient-primary mb-3">Your Projects</h1>
          <p className="text-muted-foreground text-lg">Manage and create your AI-generated debate videos.</p>
        </div>
        <button
          onClick={handleCreateNew}
          disabled={isCreating}
          className="group relative inline-flex items-center justify-center px-8 py-3.5 text-base font-bold text-white transition-all duration-200 bg-primary border border-transparent rounded-xl hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary shadow-[0_0_20px_rgba(124,58,237,0.3)] hover:shadow-[0_0_30px_rgba(124,58,237,0.5)] disabled:opacity-50"
        >
          {isCreating ? (
            <LoadingSpinner size={20} className="text-white mr-2" />
          ) : (
            <Plus className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform duration-300" />
          )}
          New Debate Video
        </button>
      </header>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner size={48} />
        </div>
      ) : projects?.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel rounded-3xl p-12 text-center flex flex-col items-center justify-center border-dashed"
        >
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <Video className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">No projects yet</h2>
          <p className="text-muted-foreground mb-8 max-w-md">Start creating your first AI-generated debate video. It only takes a few minutes to generate a full script and audio.</p>
          <button
            onClick={handleCreateNew}
            disabled={isCreating}
            className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-medium transition-colors"
          >
            Create Your First Project
          </button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects?.map((project, idx) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => setLocation(`/projects/${project.id}?step=1`)}
              className="glass-panel group cursor-pointer rounded-2xl p-6 hover:-translate-y-1 hover:shadow-primary/10 transition-all duration-300 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-black/30 rounded-xl border border-white/5">
                    <Video className="w-6 h-6 text-primary" />
                  </div>
                  <span className="flex items-center text-xs font-medium px-2.5 py-1 bg-white/5 border border-white/10 rounded-full text-muted-foreground">
                    <Clock className="w-3 h-3 mr-1" />
                    {new Date(project.createdAt || "").toLocaleDateString()}
                  </span>
                </div>
                
                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-primary transition-colors line-clamp-1">
                  {project.topic === "Untitled Debate" ? "Draft Project" : project.topic}
                </h3>
                
                <div className="flex items-center gap-3 text-sm text-muted-foreground mb-6">
                  <span className="flex items-center">
                    <Activity className="w-4 h-4 mr-1.5" />
                    {project.duration}
                  </span>
                  <span className="w-1 h-1 bg-white/20 rounded-full" />
                  <span className="truncate">{project.model.split('-')[1]}</span>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-white/5">
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold">{project.speakerAName.charAt(0)}</span>
                    <span className="text-xs">vs</span>
                    <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs font-bold">{project.speakerBName.charAt(0)}</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
