import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Settings, FileText, Mic, LayoutTemplate, ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { useProject, useUpdateProject, useUpdateDialogue, useGenerateScript, useRewriteDialogue, useGenerateAudio } from "@/hooks/use-projects";

// Mock images fallback if assets aren't strictly resolvable by vite in this exact environment setup
const mockBg1 = "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=2070&auto=format&fit=crop"; 
const mockBg2 = "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=2070&auto=format&fit=crop";

export default function Wizard() {
  const { id } = useParams<{ id: string }>();
  const projectId = parseInt(id || "0");
  const [location, setLocation] = useLocation();
  
  // Parse step from URL query or default to 1
  const searchParams = new URLSearchParams(window.location.search);
  const initialStep = parseInt(searchParams.get("step") || "1");
  const [currentStep, setCurrentStep] = useState(initialStep);

  const { data: project, isLoading: isProjectLoading } = useProject(projectId);

  // Sync step changes to URL
  useEffect(() => {
    const newUrl = `/projects/${projectId}?step=${currentStep}`;
    if (location !== newUrl) {
      window.history.replaceState(null, "", newUrl);
    }
  }, [currentStep, projectId, location]);

  if (isProjectLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-12 h-12 text-primary animate-spin" /></div>;
  }

  if (!project) {
    return <div className="min-h-screen flex items-center justify-center text-white">Project not found</div>;
  }

  const steps = [
    { num: 1, title: "Setup", icon: Settings },
    { num: 2, title: "Script", icon: FileText },
    { num: 3, title: "Audio", icon: Mic },
    { num: 4, title: "Preview", icon: LayoutTemplate },
  ];

  return (
    <div className="min-h-screen flex flex-col max-w-[1600px] mx-auto">
      {/* Header / Stepper */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setLocation("/")}
            className="p-2 hover:bg-white/5 rounded-full transition-colors text-muted-foreground hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-display font-bold text-xl text-white hidden sm:block">
            {project.topic !== "Untitled Debate" ? project.topic : "New Debate"}
          </h1>
        </div>

        <nav className="flex items-center">
          <ol className="flex items-center gap-2 sm:gap-6">
            {steps.map((step, idx) => {
              const isActive = currentStep === step.num;
              const isPast = currentStep > step.num;
              const Icon = step.icon;
              
              return (
                <li key={step.num} className="flex items-center">
                  <button
                    onClick={() => setCurrentStep(step.num)}
                    className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300 ${
                      isActive 
                        ? "border-primary bg-primary/20 text-primary shadow-[0_0_15px_rgba(124,58,237,0.4)]" 
                        : isPast 
                          ? "border-primary bg-primary text-white" 
                          : "border-white/10 bg-transparent text-gray-500 hover:border-white/30"
                    }`}
                  >
                    {isPast ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </button>
                  <span className={`hidden md:block ml-3 text-sm font-medium ${isActive ? "text-white" : isPast ? "text-gray-300" : "text-gray-600"}`}>
                    {step.title}
                  </span>
                  {idx < steps.length - 1 && (
                    <div className={`w-8 sm:w-16 h-0.5 mx-2 sm:mx-4 rounded-full ${isPast ? "bg-primary" : "bg-white/10"}`} />
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
        
        <div className="w-10"></div> {/* Spacer for balance */}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-6 lg:p-12 overflow-x-hidden relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="h-full"
          >
            {currentStep === 1 && <Step1Setup project={project} onNext={() => setCurrentStep(2)} />}
            {currentStep === 2 && <Step2Script project={project} onNext={() => setCurrentStep(3)} />}
            {currentStep === 3 && <Step3Audio project={project} onNext={() => setCurrentStep(4)} />}
            {currentStep === 4 && <Step4Preview project={project} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

// ==========================================
// STEP 1: SETUP
// ==========================================
function Step1Setup({ project, onNext }: { project: any, onNext: () => void }) {
  const updateProject = useUpdateProject();
  const [topic, setTopic] = useState(project.topic === "Untitled Debate" ? "" : project.topic);
  const [duration, setDuration] = useState(project.duration || "medium");
  const [model, setModel] = useState(project.model || "gemini-3-flash-preview");

  const handleSave = async () => {
    if (!topic.trim()) return;
    await updateProject.mutateAsync({
      id: project.id,
      topic,
      duration,
      model,
    });
    onNext();
  };

  return (
    <div className="max-w-2xl mx-auto glass-panel p-8 sm:p-12 rounded-3xl">
      <h2 className="text-3xl font-display font-bold text-white mb-2">Configure Your Debate</h2>
      <p className="text-muted-foreground mb-10">Define the core parameters for the AI to generate the script.</p>

      <div className="space-y-8">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Debate Topic</label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Artificial Intelligence vs Human Creativity"
            className="w-full px-5 py-4 rounded-xl glass-input text-lg focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3">Script Duration</label>
          <div className="grid grid-cols-3 gap-4">
            {["short", "medium", "long"].map((d) => (
              <button
                key={d}
                onClick={() => setDuration(d)}
                className={`py-3 px-4 rounded-xl font-medium capitalize border transition-all ${
                  duration === d 
                    ? "bg-primary/20 border-primary text-primary" 
                    : "bg-black/20 border-white/10 text-gray-400 hover:border-white/30"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3">AI Model</label>
          <div className="space-y-3">
            {[
              { id: "gemini-3-flash-preview", name: "Gemini 3 Flash", desc: "Fast generation, great for standard debates." },
              { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro", desc: "Deeper reasoning, nuanced arguments." }
            ].map((m) => (
              <div 
                key={m.id}
                onClick={() => setModel(m.id)}
                className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center ${
                  model === m.id
                    ? "bg-primary/10 border-primary shadow-[0_0_10px_rgba(124,58,237,0.2)]" 
                    : "bg-black/20 border-white/10 hover:border-white/30"
                }`}
              >
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center mr-4 ${model === m.id ? "border-primary" : "border-gray-500"}`}>
                  {model === m.id && <div className="w-2.5 h-2.5 bg-primary rounded-full" />}
                </div>
                <div>
                  <h4 className={`font-semibold ${model === m.id ? "text-white" : "text-gray-300"}`}>{m.name}</h4>
                  <p className="text-sm text-gray-500 mt-0.5">{m.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-6 flex justify-end">
          <button
            onClick={handleSave}
            disabled={!topic.trim() || updateProject.isPending}
            className="flex items-center px-8 py-3.5 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {updateProject.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
            Continue to Script
            <ArrowRight className="w-5 h-5 ml-2" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// STEP 2: SCRIPT EDITOR
// ==========================================
function Step2Script({ project, onNext }: { project: any, onNext: () => void }) {
  const generateScript = useGenerateScript();
  const updateProject = useUpdateProject();
  const updateDialogue = useUpdateDialogue();
  const rewriteDialogue = useRewriteDialogue();

  const [speakerA, setSpeakerA] = useState(project.speakerAName);
  const [speakerB, setSpeakerB] = useState(project.speakerBName);
  
  // Local state for editing to prevent aggressive re-renders on typing
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  
  const [rewritingId, setRewritingId] = useState<number | null>(null);
  const [rewriteInstruction, setRewriteInstruction] = useState("");

  const handleGenerate = async () => {
    await generateScript.mutateAsync(project.id);
  };

  const saveSpeakerNames = () => {
    if (speakerA !== project.speakerAName || speakerB !== project.speakerBName) {
      updateProject.mutate({ id: project.id, speakerAName: speakerA, speakerBName: speakerB });
    }
  };

  const handleSaveEdit = async (dialogueId: number) => {
    await updateDialogue.mutateAsync({ id: dialogueId, projectId: project.id, text: editText });
    setEditingId(null);
  };

  const handleRewrite = async (dialogueId: number) => {
    if (!rewriteInstruction) return;
    await rewriteDialogue.mutateAsync({ dialogueId, projectId: project.id, instructions: rewriteInstruction });
    setRewritingId(null);
    setRewriteInstruction("");
  };

  if (!project.dialogues || project.dialogues.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-20">
        <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center mb-8 shadow-[0_0_30px_rgba(124,58,237,0.3)]">
          <FileText className="w-12 h-12 text-primary" />
        </div>
        <h2 className="text-3xl font-bold text-white mb-4">Generate Script</h2>
        <p className="text-muted-foreground mb-8 text-lg">
          Let AI draft the initial debate based on your topic: <br/>
          <strong className="text-white mt-2 block">"{project.topic}"</strong>
        </p>
        <button
          onClick={handleGenerate}
          disabled={generateScript.isPending}
          className="px-8 py-4 bg-gradient-to-r from-primary to-indigo-600 text-white font-bold rounded-xl text-lg hover:shadow-lg hover:shadow-primary/50 transition-all hover:-translate-y-1 flex items-center"
        >
          {generateScript.isPending ? (
            <><Loader2 className="w-6 h-6 animate-spin mr-3" /> Generating Script...</>
          ) : (
            <>Generate Script with AI</>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto flex flex-col h-[calc(100vh-140px)]">
      <div className="flex justify-between items-end mb-6 shrink-0">
        <div>
          <h2 className="text-2xl font-display font-bold text-white">Script Editor</h2>
          <p className="text-muted-foreground">Review, edit, or ask AI to rewrite specific lines.</p>
        </div>
        <button
          onClick={onNext}
          className="px-6 py-2.5 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors flex items-center"
        >
          Next: Audio <ArrowRight className="w-4 h-4 ml-2" />
        </button>
      </div>

      {/* Speaker Headers */}
      <div className="grid grid-cols-2 gap-4 mb-4 shrink-0">
        <div className="glass-panel p-3 rounded-xl border-l-4 border-l-indigo-500 flex items-center">
          <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold mr-3">A</div>
          <input 
            value={speakerA}
            onChange={(e) => setSpeakerA(e.target.value)}
            onBlur={saveSpeakerNames}
            className="bg-transparent border-none text-white font-bold focus:outline-none focus:ring-0 w-full"
          />
        </div>
        <div className="glass-panel p-3 rounded-xl border-l-4 border-l-cyan-500 flex items-center">
          <div className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold mr-3">B</div>
          <input 
            value={speakerB}
            onChange={(e) => setSpeakerB(e.target.value)}
            onBlur={saveSpeakerNames}
            className="bg-transparent border-none text-white font-bold focus:outline-none focus:ring-0 w-full text-right"
            dir="rtl"
          />
        </div>
      </div>

      {/* Dialogues Table */}
      <div className="flex-1 overflow-y-auto pr-2 pb-10 space-y-4">
        {project.dialogues.map((dialogue: any) => {
          const isA = dialogue.speaker === 'A';
          const isEditing = editingId === dialogue.id;
          const isRewriting = rewritingId === dialogue.id;

          return (
            <div key={dialogue.id} className={`flex ${isA ? "justify-start" : "justify-end"}`}>
              <div className={`w-[85%] sm:w-[75%] glass-panel rounded-2xl p-5 relative group ${
                isA ? "border-l-4 border-l-indigo-500/50 rounded-tl-sm" : "border-r-4 border-r-cyan-500/50 rounded-tr-sm"
              }`}>
                
                {isEditing ? (
                  <div className="space-y-3">
                    <textarea 
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full h-32 glass-input p-3 rounded-lg resize-none text-white"
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setEditingId(null)} className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
                      <button 
                        onClick={() => handleSaveEdit(dialogue.id)}
                        disabled={updateDialogue.isPending}
                        className="px-4 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90"
                      >
                        {updateDialogue.isPending ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </div>
                ) : isRewriting ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-black/30 rounded-lg text-gray-300 text-sm mb-3">"{dialogue.text}"</div>
                    <input 
                      value={rewriteInstruction}
                      onChange={(e) => setRewriteInstruction(e.target.value)}
                      placeholder="e.g. Make it more aggressive, make it shorter..."
                      className="w-full glass-input p-3 rounded-lg text-white"
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setRewritingId(null)} className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
                      <button 
                        onClick={() => handleRewrite(dialogue.id)}
                        disabled={rewriteDialogue.isPending || !rewriteInstruction}
                        className="px-4 py-1.5 text-sm bg-gradient-to-r from-indigo-500 to-cyan-500 text-white rounded-lg font-medium"
                      >
                        {rewriteDialogue.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Rewrite with AI"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-gray-100 leading-relaxed text-[15px] sm:text-base">{dialogue.text}</p>
                    
                    {/* Hover Actions */}
                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 bg-background/90 p-1.5 rounded-lg border border-white/10 backdrop-blur-md">
                      <button 
                        onClick={() => { setEditingId(dialogue.id); setEditText(dialogue.text); }}
                        className="px-2 py-1 text-xs text-gray-300 hover:text-white hover:bg-white/10 rounded transition-colors"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => setRewritingId(dialogue.id)}
                        className="px-2 py-1 text-xs text-indigo-300 hover:text-indigo-100 hover:bg-indigo-500/20 rounded transition-colors flex items-center"
                      >
                        <Settings className="w-3 h-3 mr-1" /> AI Rewrite
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==========================================
// STEP 3: AUDIO GENERATION
// ==========================================
function Step3Audio({ project, onNext }: { project: any, onNext: () => void }) {
  const updateProject = useUpdateProject();
  const generateAudio = useGenerateAudio();
  
  const [voiceA, setVoiceA] = useState(project.speakerAVoice);
  const [voiceB, setVoiceB] = useState(project.speakerBVoice);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [progress, setProgress] = useState(0);

  const voices = [
    { id: "alloy", name: "Alloy", desc: "Neutral, versatile" },
    { id: "echo", name: "Echo", desc: "Warm, authoritative" },
    { id: "fable", name: "Fable", desc: "Expressive, animated" },
    { id: "onyx", name: "Onyx", desc: "Deep, serious" },
    { id: "nova", name: "Nova", desc: "Energetic, bright" },
    { id: "shimmer", name: "Shimmer", desc: "Clear, engaging" },
  ];

  const handleSaveVoices = () => {
    if (voiceA !== project.speakerAVoice || voiceB !== project.speakerBVoice) {
      updateProject.mutate({ id: project.id, speakerAVoice: voiceA, speakerBVoice: voiceB });
    }
  };

  const handleGenerateAll = async () => {
    setIsGeneratingAll(true);
    setProgress(0);
    const total = project.dialogues.length;
    
    for (let i = 0; i < total; i++) {
      try {
        await generateAudio.mutateAsync({ dialogueId: project.dialogues[i].id, projectId: project.id });
      } catch (e) {
        console.error("Failed to generate audio for dialogue", project.dialogues[i].id);
      }
      setProgress(Math.round(((i + 1) / total) * 100));
    }
    
    setIsGeneratingAll(false);
  };

  const allAudioGenerated = project.dialogues?.every((d: any) => d.audioUrl);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-display font-bold text-white mb-2">Voice Synthesis</h2>
          <p className="text-muted-foreground">Select voices and generate audio for your debate.</p>
        </div>
        <button
          onClick={onNext}
          disabled={!allAudioGenerated}
          className="px-6 py-2.5 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors flex items-center disabled:opacity-50"
          title={!allAudioGenerated ? "Generate all audio first" : ""}
        >
          Next: Preview <ArrowRight className="w-4 h-4 ml-2" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Speaker A Voice */}
        <div className="glass-panel p-6 rounded-2xl border-t-4 border-t-indigo-500">
          <h3 className="text-xl font-bold text-white mb-1">{project.speakerAName} (Speaker A)</h3>
          <p className="text-sm text-indigo-400 mb-6">Select a voice persona</p>
          <div className="grid grid-cols-2 gap-3">
            {voices.map(v => (
              <button
                key={v.id}
                onClick={() => { setVoiceA(v.id); setTimeout(handleSaveVoices, 0); }}
                className={`p-3 rounded-xl border text-left transition-all ${
                  voiceA === v.id 
                    ? "bg-indigo-500/20 border-indigo-500" 
                    : "bg-black/20 border-white/10 hover:border-white/30"
                }`}
              >
                <div className={`font-semibold ${voiceA === v.id ? "text-indigo-300" : "text-gray-300"}`}>{v.name}</div>
                <div className="text-xs text-gray-500 mt-1">{v.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Speaker B Voice */}
        <div className="glass-panel p-6 rounded-2xl border-t-4 border-t-cyan-500">
          <h3 className="text-xl font-bold text-white mb-1">{project.speakerBName} (Speaker B)</h3>
          <p className="text-sm text-cyan-400 mb-6">Select a voice persona</p>
          <div className="grid grid-cols-2 gap-3">
            {voices.map(v => (
              <button
                key={v.id}
                onClick={() => { setVoiceB(v.id); setTimeout(handleSaveVoices, 0); }}
                className={`p-3 rounded-xl border text-left transition-all ${
                  voiceB === v.id 
                    ? "bg-cyan-500/20 border-cyan-500" 
                    : "bg-black/20 border-white/10 hover:border-white/30"
                }`}
              >
                <div className={`font-semibold ${voiceB === v.id ? "text-cyan-300" : "text-gray-300"}`}>{v.name}</div>
                <div className="text-xs text-gray-500 mt-1">{v.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Generation Section */}
      <div className="glass-panel p-8 rounded-2xl flex flex-col items-center justify-center text-center">
        {isGeneratingAll ? (
          <div className="w-full max-w-md">
            <h3 className="text-xl font-bold text-white mb-4">Synthesizing Voices...</h3>
            <div className="h-3 w-full bg-black/40 rounded-full overflow-hidden mb-2 border border-white/10">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 to-cyan-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-gray-400">{progress}% Complete</p>
          </div>
        ) : (
          <>
            <Mic className="w-12 h-12 text-primary mb-4 opacity-80" />
            <h3 className="text-2xl font-bold text-white mb-2">Ready to Generate</h3>
            <p className="text-gray-400 mb-8 max-w-md">We'll use standard OpenAI TTS models to generate lifelike audio for each line of the debate.</p>
            <button
              onClick={handleGenerateAll}
              className="px-8 py-3.5 bg-gradient-to-r from-primary to-indigo-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-primary/50 transition-all hover:-translate-y-0.5"
            >
              {allAudioGenerated ? "Regenerate All Audio" : "Generate All Audio"}
            </button>
          </>
        )}
      </div>

      {/* List to show generated status (optional, for feedback) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {project.dialogues?.map((d: any) => (
          <div key={d.id} className="glass-panel p-4 rounded-xl flex items-center justify-between text-sm">
            <span className="text-gray-300 truncate pr-4">{d.speaker}: {d.text.substring(0, 30)}...</span>
            {d.audioUrl ? (
               <div className="flex items-center text-green-400 shrink-0">
                 <Check className="w-4 h-4 mr-1" /> Done
               </div>
            ) : (
               <div className="text-gray-500 shrink-0">Pending</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ==========================================
// STEP 4: VIDEO PREVIEW / CANVAS
// ==========================================
function Step4Preview({ project }: { project: any }) {
  // Static state for preview purposes
  const [currentDialogueIdx, setCurrentDialogueIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const currentDialogue = project.dialogues?.[currentDialogueIdx] || { text: "No dialogues available", speaker: "A" };
  const bgImage = project.backgroundImage || mockBg1; // Using standard static background for demo

  // Simulate playback
  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentDialogueIdx((prev) => (prev + 1) % (project.dialogues?.length || 1));
      }, 3000); // fake 3s per dialogue
    }
    return () => clearInterval(interval);
  }, [isPlaying, project.dialogues?.length]);

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-140px)] flex flex-col">
      <div className="flex justify-between items-end mb-6 shrink-0">
        <div>
          <h2 className="text-3xl font-display font-bold text-white mb-1">Video Canvas</h2>
          <p className="text-muted-foreground">Preview your debate layout. Elements are draggable.</p>
        </div>
        <button
          className="px-6 py-2.5 bg-primary text-white font-bold rounded-xl shadow-[0_0_20px_rgba(124,58,237,0.4)] hover:shadow-[0_0_30px_rgba(124,58,237,0.6)] transition-all"
        >
          Export Video
        </button>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-black flex items-center justify-center">
        
        {/* Background Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-60"
          style={{ backgroundImage: `url(${bgImage})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />

        {/* DRAGGABLE OVERLAYS */}
        
        {/* Timer */}
        <motion.div 
          drag dragMomentum={false}
          className="absolute top-6 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-md px-6 py-2 rounded-full border border-white/20 text-white font-mono text-xl font-bold cursor-move z-10"
        >
          01:24
        </motion.div>

        {/* Speaker A Identifier */}
        <motion.div 
          drag dragMomentum={false}
          className={`absolute top-20 left-10 p-4 rounded-2xl backdrop-blur-md border cursor-move z-10 transition-all ${
            currentDialogue.speaker === 'A' ? "bg-indigo-500/30 border-indigo-400 shadow-[0_0_30px_rgba(99,102,241,0.4)]" : "bg-black/40 border-white/10"
          }`}
        >
          <div className="text-lg font-bold text-white">{project.speakerAName}</div>
          {currentDialogue.speaker === 'A' && (
            <div className="mt-2 flex items-end gap-1 h-6">
              {[1,2,3,4,5].map(i => (
                <motion.div 
                  key={i}
                  animate={{ height: ["20%", "100%", "40%"] }}
                  transition={{ repeat: Infinity, duration: 0.5 + (i*0.1), ease: "easeInOut" }}
                  className="w-1.5 bg-indigo-400 rounded-t-sm"
                />
              ))}
            </div>
          )}
        </motion.div>

        {/* Speaker B Identifier */}
        <motion.div 
          drag dragMomentum={false}
          className={`absolute top-20 right-10 p-4 rounded-2xl backdrop-blur-md border cursor-move z-10 transition-all text-right ${
            currentDialogue.speaker === 'B' ? "bg-cyan-500/30 border-cyan-400 shadow-[0_0_30px_rgba(6,182,212,0.4)]" : "bg-black/40 border-white/10"
          }`}
        >
          <div className="text-lg font-bold text-white">{project.speakerBName}</div>
          {currentDialogue.speaker === 'B' && (
            <div className="mt-2 flex items-end justify-end gap-1 h-6">
              {[1,2,3,4,5].map(i => (
                <motion.div 
                  key={i}
                  animate={{ height: ["30%", "100%", "20%"] }}
                  transition={{ repeat: Infinity, duration: 0.4 + (i*0.1), ease: "easeInOut" }}
                  className="w-1.5 bg-cyan-400 rounded-t-sm"
                />
              ))}
            </div>
          )}
        </motion.div>

        {/* Main Transcript Subtitle */}
        <motion.div 
          drag dragMomentum={false}
          className="absolute bottom-20 w-[80%] max-w-4xl text-center cursor-move z-10"
        >
          <div className={`inline-block px-8 py-6 rounded-3xl backdrop-blur-lg border shadow-2xl ${
            currentDialogue.speaker === 'A' ? "bg-indigo-900/40 border-indigo-500/50" : "bg-cyan-900/40 border-cyan-500/50"
          }`}>
            <p className="text-2xl md:text-4xl font-bold text-white leading-tight drop-shadow-lg">
              {currentDialogue.text}
            </p>
          </div>
        </motion.div>

        {/* Controls Overlay (not rendered in final export) */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-4 bg-black/60 p-2 rounded-full backdrop-blur border border-white/10 z-50">
          <button onClick={() => setCurrentDialogueIdx(Math.max(0, currentDialogueIdx - 1))} className="p-2 text-white hover:bg-white/20 rounded-full">
             <ArrowLeft className="w-5 h-5" />
          </button>
          <button onClick={() => setIsPlaying(!isPlaying)} className="px-6 py-2 bg-white text-black font-bold rounded-full hover:bg-gray-200">
             {isPlaying ? "Pause" : "Play Preview"}
          </button>
          <button onClick={() => setCurrentDialogueIdx(Math.min((project.dialogues?.length || 1) - 1, currentDialogueIdx + 1))} className="p-2 text-white hover:bg-white/20 rounded-full">
             <ArrowRight className="w-5 h-5" />
          </button>
        </div>

      </div>
    </div>
  );
}
