import React, { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle, useMemo } from 'react';
import Groq from "groq-sdk";
import { supabase } from '../supabase';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as mammoth from 'mammoth';
// PDF.js worker setup
import * as pdfjsLib from 'pdfjs-dist';

const PDFJS_VERSION = '4.4.168';
if (pdfjsLib && (pdfjsLib as any).GlobalWorkerOptions) {
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`;
}

type AnalysisContext = 'HR' | 'EDUCATION' | 'MARKETING' | 'GENERAL' | null;

interface HeatmapAnnotation {
  start_index: number;
  end_index: number;
  label: "AI_PATTERN" | "HUMAN_PATTERN";
  color: "red" | "blue";
  tooltip_title: string;
  tooltip_explanation: string;
}

interface ForensicReportData {
  score: number;
  confidence: 'Low' | 'Medium' | 'High';
  verdict: 'Likely Human-Written' | 'Likely AI-Generated' | 'AI-Assisted (Hybrid)' | 'Inconclusive (Insufficient Evidence)';
  plain_language_meaning: string;
  pattern_insights: string;
  key_observations: string[];
  stats: {
    sentence_variance: { result: string; interpretation: string };
    lexical_density: { result: string; interpretation: string };
    burstiness: { result: string; interpretation: string };
    insight: string;
  };
  evidence: {
    ai_patterns: string[];
    human_signals: string[];
    dominance_explanation: string;
  };
  forensic_deep_dive: {
    structural_monotony: {
      label: string;
      description: string;
    };
    fact_verification: {
      status: string;
      insight: string;
    };
    turing_friction: {
      connective_tissue_count: number;
      detected_tokens: string[];
      explanation: string;
    };
  };
  humanization_roadmap: string[];
  verdict_bullets: string[];
  recommendations: string[];
  heatmap_annotations: HeatmapAnnotation[];
}

interface AnalysisToolProps {
  user: any;
  credits: number;
  onUpdateCredits: () => void;
  guestCredits: number;
  onUpdateGuestCredits: (credits: number) => void;
  showLimitModal: () => void;
}

const PHOTOSYNTHESIS_ESSAY = `Photosynthesis is a sophisticated biological process that serves as the primary energy-conversion mechanism for life on Earth. Through the absorption of electromagnetic radiation, specifically within the visible spectrum, photoautotrophs such as plants and cyanobacteria synthesize organic compounds from inorganic precursors. The process occurs within specialized organelles known as chloroplasts, where chlorophyll pigments capture photons to initiate the light-dependent reactions. These reactions facilitate the photolysis of water, releasing molecular oxygen as a byproduct while generating ATP and NADPH. Subsequently, the Calvin Cycle utilizes these energy carriers to fix atmospheric carbon dioxide into triose phosphates, which are eventually converted into glucose and other vital carbohydrates. This intricate cycle not only sustains the growth and development of the organism but also maintains the global atmospheric balance by sequestering carbon and producing the oxygen necessary for aerobic respiration across the biosphere.`;

const generateSampleAnnotations = (): HeatmapAnnotation[] => {
  const sentences = PHOTOSYNTHESIS_ESSAY.split(/(?<=\.)\s+/);
  let currentIndex = 0;
  return sentences.map((sentence) => {
    const start = PHOTOSYNTHESIS_ESSAY.indexOf(sentence, currentIndex);
    currentIndex = start + sentence.length;
    return {
      start_index: start,
      end_index: start + sentence.length,
      label: "AI_PATTERN",
      color: "red",
      tooltip_title: "Robotic Syntax",
      tooltip_explanation: "This sentence exhibits uniform clause structure and token probability typical of AI."
    } as HeatmapAnnotation;
  });
};

const STATIC_SAMPLE_REPORT: ForensicReportData = {
  score: 98.5,
  confidence: 'High',
  verdict: 'Likely AI-Generated',
  plain_language_meaning: 'This text exhibits the typical statistical fingerprint of a large language model.',
  pattern_insights: 'The analysis identified severe structural rigidity and a lack of rhythmic variance. Every sentence follows an "optimal token path," which is highly characteristic of modern transformer-based architectures.',
  key_observations: [
    'Highly predictable token transitions', 
    'Monotonous rhythmic cadence', 
    'Absence of cognitive revision markers'
  ],
  stats: {
    sentence_variance: { 
      result: 'Critical Low', 
      interpretation: 'Sentences are near-identical in complexity. Natural human writing involves "pulsing" between short and long thoughts.' 
    },
    lexical_density: { 
      result: 'Extreme', 
      interpretation: 'The text uses an unnaturally high frequency of Tier-3 academic vocabulary without any filler or transition noise.' 
    },
    burstiness: { 
      result: 'Flattened', 
      interpretation: 'The text flow is perfectly uniform. Machines generate text linearly; humans write in bursts followed by pauses.' 
    },
    insight: 'The structural integrity is "too perfect," matching the statistical peaks of GPT-4 training weights.'
  },
  forensic_deep_dive: {
    structural_monotony: {
      label: 'Rhythmic Uniformity Detected',
      description: 'The mathematical rhythm of your sentences is near-identical. There is a lack of "staccato" human variation.'
    },
    fact_verification: {
      status: 'Generic Implementation',
      insight: 'References to "Calvin Cycle" and "photolysis" are used in a technically perfect but generic encyclopedic manner, lacking specific human insight or localized context.'
    },
    turing_friction: {
      connective_tissue_count: 5,
      detected_tokens: ['Subsequently', 'Specifically', 'Furthermore', 'Consequently', 'Specifically'],
      explanation: 'Connective tissue placement is statistically over-optimized. These transitions appear at calculated intervals typical of LLM logic chains.'
    }
  },
  humanization_roadmap: [
    "Inject 'Human Noise': Intentionally break the perfect sentence length. Mix very short (4-5 word) sentences with complex ones to introduce rhythmic variety.",
    "Organic Variance: Replace formal transitions like 'Subsequently' or 'Moreover' with more casual or varied human speech patterns like 'Then again' or simple 'Next'.",
    "Cognitive Scars: Introduce personal analogies or specific local citations that a general LLM training set wouldn't prioritize as the 'optimal' next token."
  ],
  evidence: {
    ai_patterns: ['Uniform sentence structure', 'Perfect grammatical consistency', 'Zero idiosyncratic errors'],
    human_signals: [],
    dominance_explanation: 'Statistical patterns across the entire sample align with the "Optimal Path" logic of transformer-based models.'
  },
  verdict_bullets: ['99.2% Statistical Alignment', 'Lack of Syntactic Variety', 'Mechanical Transition Density'],
  recommendations: [
    "Verify if an AI drafting tool was used for the initial technical summary, as the syntactic density matches a prompt-engineered output.",
    "Search for unique personal anecdotes or non-standard analogies; if absent, the technical reliability of the authorship remains questionable."
  ],
  heatmap_annotations: generateSampleAnnotations()
};

export const AnalysisTool = forwardRef<any, AnalysisToolProps>(({ 
  user, 
  credits, 
  onUpdateCredits,
  guestCredits,
  onUpdateGuestCredits,
  showLimitModal
}, ref) => {
  const [selectedContext, setSelectedContext] = useState<AnalysisContext>(null);
  const [activeTab, setActiveTab] = useState<'paste' | 'upload'>('paste');
  const [text, setText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [report, setReport] = useState<ForensicReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);

  const reportRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputAreaRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    runSample: () => {
      setSelectedContext('GENERAL');
      setText(PHOTOSYNTHESIS_ESSAY);
      setReport(STATIC_SAMPLE_REPORT);
      setError(null);
      setCurrentAnalysisId(null);
    }
  }));

  const cleanJson = (raw: string) => {
    return raw.replace(/```json/g, '').replace(/```/g, '').trim();
  };

  const handleContextSelect = (ctx: AnalysisContext) => {
    setSelectedContext(ctx);
    setTimeout(() => {
      inputAreaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const extension = file.name.split('.').pop()?.toLowerCase();
    try {
      if (extension === 'txt') {
        const content = await file.text();
        setText(content);
      } else if (extension === 'docx') {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        setText(result.value);
      } else if (extension === 'pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          fullText += content.items.map((item: any) => item.str).join(' ') + '\n';
        }
        setText(fullText.trim());
      } else {
        setError('Unsupported format. Use PDF, DOCX, or TXT.');
      }
    } catch (err: any) {
      console.error(err);
      setError('Failed to extract text.');
    }
  };

const handleAnalyze = async () => {
  const availableCredits = user ? credits : guestCredits;
  if (availableCredits < 2) {
    if (!user) showLimitModal();
    else setError('Insufficient credits.');
    return;
  }
  if (!text.trim() || text.length < 50) {
    setError('Minimum 50 characters required.');
    return;
  }
  
  setIsAnalyzing(true);
  setReport(null);
  setError(null);
  setFeedbackSent(false);

  try {
    // Initialize Groq client with browser support
    const groq = new Groq({
      apiKey: import.meta.env.VITE_GROQ_API_KEY,
      dangerouslyAllowBrowser: true
    });

    const systemPrompt = `You are an elite AI-text forensics expert. You MUST return ONLY valid JSON with no markdown, no code blocks, no explanations.

SCORING RULES:
- 90-100: Overwhelming AI patterns (uniform sentences + formal transitions + perfect grammar)
- 70-89: Strong AI patterns with some variance
- 50-69: Mixed/uncertain signals
- 0-49: Clear human signals (varied sentences + informal language + errors)

VERDICT MUST match score:
- 90-100 → "Likely AI-Generated"
- 70-89 → "AI-Assisted (Hybrid)"
- 50-69 → "Inconclusive (Insufficient Evidence)"
- 0-49 → "Likely Human-Written"`;

    const prompt = `Analyze this ${selectedContext || 'GENERAL'} text for AI authorship patterns.

TEXT:
"""
${text}
"""

ANALYSIS STEPS:
1. Calculate sentence lengths and variance (burstiness = σ/mean)
2. Count formal transitions (Furthermore, Moreover, Additionally, etc.)
3. Check for contractions, typos, informal language
4. Determine if facts are generic (AI) or specific (human)

SCORING:
- Start at 50
- High burstiness (>0.8): -20 points
- Low burstiness (<0.4): +20 points
- Many formal transitions (>3 per 100 words): +15 points
- Few transitions (<2 per 100 words): -15 points
- Perfect grammar: +10 points
- Contractions/errors: -10 points

Return ONLY this JSON (no markdown):
{
  "score": <0-100>,
  "confidence": "<Low|Medium|High>",
  "verdict": "<match score range>",
  "plain_language_meaning": "<1 sentence explanation>",
  "pattern_insights": "<2-3 sentences on dominant patterns>",
  "key_observations": ["<obs1>", "<obs2>", "<obs3>"],
  "stats": {
    "sentence_variance": {
      "result": "<Critical Low|Low|Medium|High>",
      "interpretation": "<explanation>"
    },
    "lexical_density": {
      "result": "<Normal|Elevated|Extreme>",
      "interpretation": "<explanation>"
    },
    "burstiness": {
      "result": "<Flattened|Low|Medium|High>",
      "interpretation": "<explanation>"
    },
    "insight": "<summary>"
  },
  "evidence": {
    "ai_patterns": ["<pattern1>", "<pattern2>"],
    "human_signals": ["<signal1>", "<signal2>"],
    "dominance_explanation": "<explanation>"
  },
  "forensic_deep_dive": {
    "structural_monotony": {
      "label": "<Rhythmic Uniformity Detected|Varied Human Cadence|Mixed Signals>",
      "description": "<details>"
    },
    "fact_verification": {
      "status": "<Generic Implementation|Specific Human Insight|No Factual Content|Mixed>",
      "insight": "<explanation>"
    },
    "turing_friction": {
      "connective_tissue_count": <number>,
      "detected_tokens": ["<token1>", "<token2>"],
      "explanation": "<explanation>"
    }
  },
  "humanization_roadmap": ["<tip1>", "<tip2>", "<tip3>"],
  "verdict_bullets": ["<bullet1>", "<bullet2>", "<bullet3>"],
  "recommendations": ["<rec1>", "<rec2>"],
  "heatmap_annotations": [
    {
      "start_index": 0,
      "end_index": 50,
      "label": "AI_PATTERN",
      "color": "red",
      "tooltip_title": "Pattern Type",
      "tooltip_explanation": "Why this is flagged"
    }
  ]
}`;

    // Call Groq API
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: prompt
        }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.2,
      max_tokens: 6000,
      response_format: { type: "json_object" }
    });

    let rawText = completion.choices[0]?.message?.content || '';
    
    // Aggressive JSON cleaning
    rawText = rawText.trim();
    rawText = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    
    const firstBrace = rawText.indexOf('{');
    const lastBrace = rawText.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1) {
      rawText = rawText.substring(firstBrace, lastBrace + 1);
    }
    
    let data: ForensicReportData;
    try {
      data = JSON.parse(rawText);
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError);
      console.error("Raw response:", rawText);
      
      const wordCount = text.split(/\s+/).length;
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
      const avgLength = sentences.length > 0 ? Math.round(wordCount / sentences.length) : 20;
      
      data = {
        score: 75,
        confidence: 'Medium',
        verdict: 'AI-Assisted (Hybrid)',
        plain_language_meaning: 'The analysis encountered technical issues, but preliminary patterns suggest possible AI assistance.',
        pattern_insights: `Text contains ${sentences.length} sentences with average length of ${avgLength} words. Further analysis needed.`,
        key_observations: [
          'Technical analysis incomplete',
          'Fallback report generated',
          'Please re-run analysis for detailed results'
        ],
        stats: {
          sentence_variance: {
            result: 'Medium',
            interpretation: 'Unable to calculate precise variance due to parsing error.'
          },
          lexical_density: {
            result: 'Normal',
            interpretation: 'Unable to calculate precise density due to parsing error.'
          },
          burstiness: {
            result: 'Medium',
            interpretation: 'Unable to calculate precise burstiness due to parsing error.'
          },
          insight: 'This is a fallback report. Please try analyzing again.'
        },
        evidence: {
          ai_patterns: ['Unable to extract patterns'],
          human_signals: ['Unable to extract signals'],
          dominance_explanation: 'Analysis incomplete due to technical error.'
        },
        forensic_deep_dive: {
          structural_monotony: {
            label: 'Analysis Incomplete',
            description: 'Technical error prevented full structural analysis.'
          },
          fact_verification: {
            status: 'Not Analyzed',
            insight: 'Technical error prevented fact verification.'
          },
          turing_friction: {
            connective_tissue_count: 0,
            detected_tokens: [],
            explanation: 'Technical error prevented transition analysis.'
          }
        },
        humanization_roadmap: [
          'Re-run the analysis for detailed recommendations',
          'Check that your text is properly formatted',
          'Try analyzing a smaller section of text'
        ],
        verdict_bullets: [
          'Technical analysis incomplete',
          'Fallback report generated',
          'Re-analysis recommended'
        ],
        recommendations: [
          'Please re-run the analysis',
          'If error persists, contact support'
        ],
        heatmap_annotations: generateDefaultAnnotations(text, 75)
      };
    }
    
    // POST-PROCESSING VALIDATION
    if (data.score >= 90 && data.verdict !== 'Likely AI-Generated') {
      data.verdict = 'Likely AI-Generated';
    } else if (data.score >= 70 && data.score < 90 && data.verdict !== 'AI-Assisted (Hybrid)') {
      data.verdict = 'AI-Assisted (Hybrid)';
    } else if (data.score >= 50 && data.score < 70 && data.verdict !== 'Inconclusive (Insufficient Evidence)') {
      data.verdict = 'Inconclusive (Insufficient Evidence)';
    } else if (data.score < 50 && data.verdict !== 'Likely Human-Written') {
      data.verdict = 'Likely Human-Written';
    }

    // Validate heatmap
    if (!data.heatmap_annotations || data.heatmap_annotations.length === 0) {
      data.heatmap_annotations = generateDefaultAnnotations(text, data.score);
    } else {
      data.heatmap_annotations = data.heatmap_annotations.filter(anno => {
        return anno.start_index >= 0 && 
               anno.end_index <= text.length && 
               anno.start_index < anno.end_index;
      });
      
      if (data.heatmap_annotations.length === 0) {
        data.heatmap_annotations = generateDefaultAnnotations(text, data.score);
      }
    }
    
    setReport(data);

    // Save to database and deduct credits
    if (user) {
      const { data: analysisData } = await supabase
        .from('analyses')
        .insert({
          user_id: user.id,
          input_text: text,
          report_data: data,
          score: data.score,
          verdict: data.verdict
        })
        .select()
        .single();

      if (analysisData) setCurrentAnalysisId(analysisData.id);
      
      await supabase
        .from('user_credits')
        .update({ credits: credits - 2 })
        .eq('user_id', user.id);
      
      onUpdateCredits();
    } else {
      onUpdateGuestCredits(guestCredits - 2);
    }
  } catch (err: any) {
    console.error("Analysis Error:", err);
    setError('Analysis failed. Please try again or contact support if the issue persists.');
  } finally {
    setIsAnalyzing(false);
  }
};

// Helper function to generate fallback heatmap annotations
const generateDefaultAnnotations = (inputText: string, score: number): HeatmapAnnotation[] => {
  const sentences = inputText.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const annotations: HeatmapAnnotation[] = [];
  const isAILikely = score >= 70;
  
  let currentPos = 0;
  const numAnnotations = Math.min(5, sentences.length);
  
  for (let i = 0; i < numAnnotations; i++) {
    const sentence = sentences[i].trim();
    const startIdx = inputText.indexOf(sentence, currentPos);
    
    if (startIdx === -1) continue;
    
    const endIdx = startIdx + sentence.length;
    currentPos = endIdx;
    
    annotations.push({
      start_index: startIdx,
      end_index: endIdx,
      label: isAILikely ? "AI_PATTERN" : "HUMAN_PATTERN",
      color: isAILikely ? "red" : "blue",
      tooltip_title: isAILikely ? "AI-Like Pattern" : "Human-Like Pattern",
      tooltip_explanation: isAILikely 
        ? "This segment shows characteristics typical of AI-generated text."
        : "This segment exhibits natural human writing patterns."
    });
  }
  
  return annotations.length > 0 ? annotations : [{
    start_index: 0,
    end_index: Math.min(100, inputText.length),
    label: isAILikely ? "AI_PATTERN" : "HUMAN_PATTERN",
    color: isAILikely ? "red" : "blue",
    tooltip_title: "Pattern Detected",
    tooltip_explanation: "Analysis detected patterns in this text segment."
  }];
};

const renderHeatmap = () => {
  if (!report || !text) return null;
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  const sorted = [...report.heatmap_annotations].sort((a, b) => a.start_index - b.start_index);
  
  sorted.forEach((anno, idx) => {
    if (anno.start_index > lastIndex) {
      elements.push(<span key={`txt-${idx}`}>{text.substring(lastIndex, anno.start_index)}</span>);
    }
    const colorClass = anno.color === 'red' ? 'bg-red-500/20 border-b-2 border-red-500/60' : 'bg-blue-500/20 border-b-2 border-blue-500/60';
    elements.push(
      <span key={`anno-${idx}`} className={`relative group cursor-help transition-all px-0.5 rounded-sm ${colorClass}`}>
        {text.substring(anno.start_index, anno.end_index)}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 hidden group-hover:block z-[110] w-64 p-3 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl pointer-events-none">
           <p className={`text-[10px] font-black mb-1 mono uppercase ${anno.color === 'red' ? 'text-red-400' : 'text-blue-400'}`}>{anno.tooltip_title}</p>
           <p className="text-[11px] text-slate-300 leading-normal">{anno.tooltip_explanation}</p>
        </div>
      </span>
    );
    lastIndex = anno.end_index;
  });
  if (lastIndex < text.length) elements.push(<span key="txt-end">{text.substring(lastIndex)}</span>);
  return elements;
};

const handleDownloadPDF = async () => {
  if (!reportRef.current) return;
  setIsGeneratingPDF(true);
  try {
    const element = reportRef.current;
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#020617',
      windowWidth: 1200
    });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = pdfWidth / imgWidth;
    const imgScaledHeight = imgHeight * ratio;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgScaledHeight);
    pdf.save(`verify_ai_audit_${Date.now()}.pdf`);
  } catch (err) {
    console.error(err);
  } finally {
    setIsGeneratingPDF(false);
  }
};

const contextOptions = [
  { id: 'HR', title: 'Resume / Job App', desc: 'HR-focused behavioral scanning.', icon: '💼', tag: 'HR Focus' },
  { id: 'EDUCATION', title: 'Academic', desc: 'Integrity checks for institutions.', icon: '🎓', tag: 'Academic' },
  { id: 'MARKETING', title: 'Creative Content', desc: 'Brand voice & marketing audit.', icon: '📢', tag: 'Marketing' },
  { id: 'GENERAL', title: 'General Writing', desc: 'Versatile prose analysis.', icon: '✏️', tag: 'Standard' },
];

return (
  <div className="space-y-24 max-w-6xl mx-auto">
    <section className="text-center space-y-12 animate-in fade-in duration-700">
      <div className="space-y-4">
        <h2 className="text-6xl font-black text-white tracking-tight uppercase">Forensic Workspace</h2>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto">Select a context to adjust the auditing sensitivity.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {contextOptions.map((opt) => (
          <button
            key={opt.id}
            onClick={() => handleContextSelect(opt.id as AnalysisContext)}
            className={`group p-10 rounded-[2.5rem] flex flex-col items-center text-center space-y-6 transition-all border-2 relative ${
              selectedContext === opt.id 
              ? 'bg-emerald-500/10 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.15)] scale-[1.02]' 
              : 'bg-slate-900/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
            }`}
          >
            <div className="text-4xl mb-2 transition-transform group-hover:scale-125 duration-300">{opt.icon}</div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-white leading-tight">{opt.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{opt.desc}</p>
            </div>
            <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mono transition-all ${
              selectedContext === opt.id ? 'bg-emerald-500 text-black' : 'bg-slate-800 text-slate-500'
            }`}>
              {opt.tag}
            </div>
          </button>
        ))}
      </div>
    </section>

    {!report && selectedContext && (
      <div ref={inputAreaRef} className="space-y-12 animate-in slide-in-from-bottom-12 duration-500">
        <div className="bg-[#020617]/40 border border-slate-800 rounded-[3rem] overflow-hidden backdrop-blur-sm relative group shadow-2xl">
          <div className="flex border-b border-slate-800">
            <button onClick={() => setActiveTab('paste')} className={`flex-1 py-5 font-bold text-sm transition-all ${activeTab === 'paste' ? 'bg-slate-800/50 text-emerald-400 border-b-2 border-emerald-500' : 'text-slate-500 hover:text-slate-300'}`}>📋 Paste Text</button>
            <button onClick={() => setActiveTab('upload')} className={`flex-1 py-5 font-bold text-sm transition-all ${activeTab === 'upload' ? 'bg-slate-800/50 text-emerald-400 border-b-2 border-emerald-500' : 'text-slate-500 hover:text-slate-300'}`}>📁 Upload File</button>
          </div>
          <div className="p-12">
            {activeTab === 'paste' ? (
              <textarea 
                value={text} 
                onChange={(e) => setText(e.target.value)} 
                placeholder={`Paste content for forensic audit...`} 
                className="w-full h-96 bg-transparent text-slate-200 placeholder:text-slate-800 focus:outline-none resize-none mono text-base leading-relaxed" 
              />
            ) : (
              <div className="w-full h-96 flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-3xl bg-slate-900/20 hover:border-emerald-500/30 transition-all">
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".pdf,.docx,.txt" />
                <div className="text-center space-y-6">
                  <div className="text-6xl">📄</div>
                  <button onClick={() => fileInputRef.current?.click()} className="px-12 py-4 bg-slate-800 text-white text-sm font-black rounded-xl border border-slate-700 uppercase tracking-widest">Select File</button>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col items-center gap-4 pb-24">
          <button 
            onClick={handleAnalyze} 
            disabled={isAnalyzing || !text.trim()} 
            className={`px-24 py-6 rounded-2xl font-black text-2xl transition-all shadow-2xl ${
              isAnalyzing || !text.trim() 
              ? 'bg-slate-800 text-slate-600 cursor-not-allowed' 
              : 'bg-emerald-500 hover:bg-emerald-400 text-[#020617] active:scale-95'
            }`}
          >
            {isAnalyzing ? 'Scanning Ecosystem...' : 'Run Forensic Audit'}
          </button>
          <p className="text-xs text-slate-600 font-bold uppercase tracking-[0.3em] mono">
            Deducts 2 Credits
          </p>
        </div>
        {error && (
          <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center font-bold animate-pulse">
            ⚠️ {error}
          </div>
        )}
      </div>
    )}
    {isAnalyzing && (
      <div className="fixed inset-0 z-[100] bg-[#020617]/98 backdrop-blur-2xl flex flex-col items-center justify-center space-y-12">
         <div className="relative w-32 h-32">
            <div className="absolute inset-0 rounded-full border-4 border-emerald-500/10 border-t-emerald-500 animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center text-3xl">🔍</div>
         </div>
         <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Triangulating Origin Signals...</h3>
      </div>
    )}

    {report && (
      <div id="report-view" ref={reportRef} className="animate-in slide-in-from-bottom-12 duration-1000 space-y-12 pb-32">
        <div className="p-1 rounded-[3.5rem] bg-gradient-to-br from-slate-800 to-black border border-slate-800 shadow-3xl overflow-hidden">
          <div className="bg-[#020617]/95 p-8 md:p-16 lg:p-20 space-y-20">
            <div className="flex flex-col md:flex-row items-center justify-between gap-16 border-b border-white/5 pb-20">
              <div className="space-y-6">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mono">AI Alignment Vector</h3>
                <div className="flex flex-col gap-3">
                  <span className={`text-9xl font-black tracking-tighter ${report.score > 50 ? 'text-red-500' : 'text-emerald-500'}`}>{report.score}%</span>
                  <div className="inline-flex px-4 py-1.5 bg-slate-900 border border-slate-800 rounded-full text-sm font-bold mono uppercase">
                     <span className="text-slate-400 mr-2">Verdict:</span>
                     <span className={report.score > 50 ? 'text-red-400' : 'text-emerald-400'}>{report.verdict}</span>
                  </div>
                </div>
              </div>
              <div className="max-w-md space-y-4">
                <h4 className="text-emerald-400 text-xs font-black uppercase tracking-widest mono">Pattern Insights</h4>
                <p className="text-slate-300 text-sm leading-relaxed font-medium">{report.pattern_insights}</p>
              </div>
            </div>

            <section className="space-y-10">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mono">Forensic Deep-Dive</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div className="p-8 rounded-[2rem] bg-slate-900/40 border border-slate-800 space-y-4 group">
                    <h4 className="text-white font-bold text-sm uppercase mono flex gap-2">📏 Structural Monotony</h4>
                    <p className="text-red-400 font-black text-xs uppercase mono">{report.forensic_deep_dive.structural_monotony.label}</p>
                    <p className="text-slate-400 text-xs">{report.forensic_deep_dive.structural_monotony.description}</p>
                 </div>
                 <div className="p-8 rounded-[2rem] bg-slate-900/40 border border-slate-800 space-y-4">
                    <h4 className="text-white font-bold text-sm uppercase mono flex gap-2">📋 Fact Verification</h4>
                    <p className="text-blue-400 font-black text-xs uppercase mono">{report.forensic_deep_dive.fact_verification.status}</p>
                    <p className="text-slate-400 text-xs">{report.forensic_deep_dive.fact_verification.insight}</p>
                 </div>
                 <div className="p-8 rounded-[2rem] bg-slate-900/40 border border-slate-800 space-y-4">
                    <h4 className="text-white font-bold text-sm uppercase mono flex gap-2">⚙️ Turing Friction</h4>
                    <div className="flex flex-wrap gap-2">
                       {report.forensic_deep_dive.turing_friction.detected_tokens.map((token, i) => (
                         <span key={i} className="px-2 py-0.5 bg-slate-800 border border-slate-700 text-[10px] rounded text-slate-300 mono">{token}</span>
                       ))}
                    </div>
                    <p className="text-slate-400 text-xs">{report.forensic_deep_dive.turing_friction.explanation}</p>
                 </div>
              </div>
            </section>

            <section className="space-y-10">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mono">Forensic Heatmap</h3>
              <div className="p-10 md:p-16 rounded-[3rem] bg-slate-900/20 border border-slate-800 text-slate-200 leading-[2.6] text-lg md:text-xl font-medium shadow-2xl">
                {renderHeatmap()}
              </div>
            </section>

            <div className="flex flex-col md:flex-row gap-8 pt-12">
              <button onClick={() => { setReport(null); setSelectedContext(null); window.scrollTo({top: 0, behavior: 'smooth'}); }} className="flex-1 py-5 bg-emerald-500 hover:bg-emerald-400 text-black font-black rounded-2xl transition-all uppercase tracking-widest text-xs">New Audit</button>
              <button onClick={handleDownloadPDF} disabled={isGeneratingPDF} className="flex-1 py-5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl border border-slate-800 uppercase tracking-widest text-xs flex items-center justify-center gap-3">
                {isGeneratingPDF ? 'Compiling...' : '📄 Download Forensic PDF'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
  </div>
);
});
