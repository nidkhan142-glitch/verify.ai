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

    const systemPrompt = `You are an elite AI-text forensics expert at Verify AI. You perform clinical, mathematically rigorous authorship analysis.

# CORE DETECTION FRAMEWORK

## AI-Generated Text Signatures:
1. **Structural Monotony**: Sentences within 15-25 words with <20% variance
2. **Lexical Over-Optimization**: Excessive Tier-3 vocabulary (sophistication, facilitate, subsequently)
3. **Connective Tissue Overuse**: High frequency of: "Furthermore", "Moreover", "Additionally", "Subsequently", "In conclusion", "Consequently", "Therefore", "Thus", "Hence", "Specifically", "Notably"
4. **Perfect Grammar**: Zero typos, no contractions, no colloquialisms
5. **Generic Factual Treatment**: Citations used encyclopedically without personal insight
6. **Balanced Structure**: Every paragraph ~same length, no tangents
7. **Predictable Flow**: Topic sentence → elaboration → conclusion pattern

## Human-Written Text Signatures:
1. **High Burstiness**: Mix of 3-5 word sentences and 30+ word sentences
2. **Lexical Variance**: Casual language mixed with formal, contractions, idioms
3. **Natural Transitions**: Varied or minimal connective tissue
4. **Organic Errors**: Typos, awkward phrasing, informal speech patterns
5. **Specific Insight**: Personal anecdotes, unique perspectives, localized context
6. **Asymmetric Structure**: Varying paragraph lengths, digressions
7. **Unpredictable Flow**: Stream-of-consciousness elements, non-linear thinking

## SCORING RUBRIC (AI Probability):
- **95-100%**: Near-perfect AI signature (uniform structure + high connective tissue + zero errors)
- **85-94%**: Strong AI patterns (consistent sentence length + formal vocabulary + few human signals)
- **70-84%**: Moderate AI patterns (some variance but clear optimization)
- **50-69%**: Hybrid/Uncertain (mixed signals, possibly AI-assisted human writing)
- **30-49%**: Weak AI patterns (more human variance than AI optimization)
- **0-29%**: Clear human authorship (high burstiness + organic errors + unique voice)

## VERDICT MAPPING (STRICT):
- Score 90-100 → "Likely AI-Generated"
- Score 70-89 → "AI-Assisted (Hybrid)"
- Score 50-69 → "Inconclusive (Insufficient Evidence)"
- Score 0-49 → "Likely Human-Written"

You MUST return valid JSON with no markdown formatting.`;

    const contextGuidance = {
      HR: "Focus on behavioral authenticity, personal narrative consistency, and genuine career reflection vs. resume optimization patterns.",
      EDUCATION: "Analyze academic integrity markers: original argumentation, proper citation style, depth of analysis vs. surface-level synthesis.",
      MARKETING: "Examine brand voice authenticity, creative variance, emotional resonance vs. template-driven copy patterns.",
      GENERAL: "Apply comprehensive forensic analysis across all dimensions without specialized focus."
    };

    const prompt = `Perform a comprehensive forensic authorship audit on this ${selectedContext} context text.

# TEXT TO ANALYZE:
"""
${text}
"""

# FORENSIC ANALYSIS PROTOCOL

## PHASE 1: QUANTITATIVE METRICS
Execute these calculations:

1. **Sentence Analysis**:
   - Count total sentences
   - Calculate each sentence length (words)
   - Compute mean sentence length
   - Compute standard deviation (σ) of sentence lengths
   - Burstiness Score = σ / mean (Higher = more human variance)

2. **Lexical Analysis**:
   - Total word count
   - Unique word count
   - Lexical Diversity = unique/total
   - Count Tier-3 academic words (sophistication, facilitate, implement, demonstrate, etc.)
   - Count contractions (don't, can't, it's)
   - Count informal markers (really, actually, basically, etc.)

3. **Connective Tissue Audit**:
   - Count occurrences: "Furthermore", "Moreover", "Additionally", "Subsequently", "In conclusion", "Consequently", "Therefore", "Thus", "Hence", "Specifically", "Notably", "In addition", "However"
   - Calculate density: connectives per 100 words

4. **Error Detection**:
   - Grammar errors: 0 = AI-like
   - Typos: 0 = AI-like
   - Awkward phrasing: presence = human-like

## PHASE 2: PATTERN RECOGNITION

1. **Structural Monotony Check**:
   - If sentence length σ < 5 words AND mean 15-25 words → FLAG: "Rhythmic Uniformity Detected"
   - If σ > 10 words → FLAG: "High Human Burstiness"

2. **Fact Verification Layer**:
   - Identify all citations, names, specific references
   - Assess if used generically (AI) or with specific insight/context (human)
   - Example AI: "Calvin Cycle" mentioned encyclopedically
   - Example Human: "Calvin Cycle" connected to specific research or personal lab experience

3. **Turing Friction Analysis**:
   - If connective tissue density > 3 per 100 words → FLAG: "Over-Optimized Transitions"
   - If connectives appear at regular intervals → FLAG: "Statistical Placement Pattern"

## PHASE 3: SCORING DECISION

Based on above analysis, calculate final score:
- Start at 50 (neutral)
- Add points for AI patterns:
  - Low burstiness (σ/mean < 0.5): +20 points
  - High connective tissue (>3 per 100 words): +15 points
  - Zero errors/contractions: +10 points
  - Uniform sentence length (σ < 5): +20 points
  - Generic fact usage: +10 points
  - Balanced paragraph structure: +10 points
- Subtract points for human patterns:
  - High burstiness (σ/mean > 0.8): -20 points
  - Low connective tissue (<2 per 100 words): -15 points
  - Contractions/informal language present: -10 points
  - Varied sentence length (σ > 10): -20 points
  - Specific/personal fact usage: -10 points
  - Asymmetric structure: -10 points

Final score must be 0-100.

## PHASE 4: HEATMAP GENERATION

Select 5-10 representative segments from the text:
- For AI patterns: formal transitions, uniform sentences, generic statements
- For human patterns: informal language, unique phrasing, varied rhythm
- Provide EXACT character indices (start_index, end_index) from the original text
- Each annotation needs clear explanation of why it's flagged

## PHASE 5: HUMANIZATION ROADMAP

Provide 3 specific, actionable tips to rewrite the text to score lower (more human):
- Tip 1: Address sentence variance
- Tip 2: Address vocabulary/transitions
- Tip 3: Address content depth/authenticity

## CONTEXT-SPECIFIC RECOMMENDATIONS

For ${selectedContext} context: ${contextGuidance[selectedContext as keyof typeof contextGuidance]}

---

# REQUIRED JSON OUTPUT

Return this EXACT structure (no markdown, no backticks):

{
  "score": <number 0-100, calculated from forensic analysis>,
  "confidence": "<High if clear patterns | Medium if mixed | Low if insufficient data>",
  "verdict": "<MUST match score: 90-100='Likely AI-Generated' | 70-89='AI-Assisted (Hybrid)' | 50-69='Inconclusive (Insufficient Evidence)' | 0-49='Likely Human-Written'>",
  "plain_language_meaning": "<1 sentence: If score >70, explain AI patterns found. If <50, explain human signals found.>",
  "pattern_insights": "<2-3 sentences summarizing the DOMINANT forensic findings. Be specific about metrics calculated (burstiness, connective tissue count, etc.)>",
  "key_observations": [
    "<Observation 1: Most significant finding from analysis>",
    "<Observation 2: Second most significant finding>",
    "<Observation 3: Third most significant finding>"
  ],
  "stats": {
    "sentence_variance": {
      "result": "<Report actual σ/mean ratio and classify as: Critical Low (<0.3) | Low (0.3-0.5) | Medium (0.5-0.8) | High (>0.8)>",
      "interpretation": "<Explain what this means: Low variance indicates uniform AI-generated structure. High variance indicates human burstiness with mix of short and long sentences.>"
    },
    "lexical_density": {
      "result": "<Report unique/total ratio and classify as: Normal (0.4-0.6) | Elevated (0.6-0.75) | Extreme (>0.75)>",
      "interpretation": "<Explain: Extreme density with heavy Tier-3 vocabulary indicates AI optimization. Normal density with casual language indicates human writing.>"
    },
    "burstiness": {
      "result": "<Report actual burstiness score and classify as: Flattened (<0.4) | Low (0.4-0.6) | Medium (0.6-0.8) | High (>0.8)>",
      "interpretation": "<Explain: Flattened burstiness indicates mechanical AI flow with uniform sentences. High burstiness indicates natural human variation in thought complexity.>"
    },
    "insight": "<1-2 sentences tying statistical findings together to support the final score>"
  },
  "evidence": {
    "ai_patterns": [
      "<Specific AI pattern with data, e.g., 'All 8 sentences between 18-22 words (σ=1.8)'>",
      "<Another specific pattern, e.g., '6 formal connectives detected (Furthermore x2, Moreover x2, Subsequently x2)'>"
    ],
    "human_signals": [
      "<Specific human signal with data, e.g., '3 contractions used (don't, can't, it's)'>",
      "<Another signal, e.g., 'Sentence lengths vary wildly: 4, 28, 6, 35 words (σ=14.2)'>"
    ],
    "dominance_explanation": "<2-3 sentences explaining which pattern category (AI or human) has more evidence and why this led to the final score>"
  },
  "forensic_deep_dive": {
    "structural_monotony": {
      "label": "<Based on burstiness: 'Rhythmic Uniformity Detected' (low burstiness) | 'Varied Human Cadence' (high burstiness) | 'Mixed Signals' (medium)>",
      "description": "<Detailed explanation: Report actual sentence length data, standard deviation, and what this indicates about authorship. Include specific examples from the text.>"
    },
    "fact_verification": {
      "status": "<'Generic Implementation' (AI-like) | 'Specific Human Insight' (human-like) | 'No Factual Content' | 'Mixed Usage'>",
      "insight": "<Explain how any facts, citations, or specific references are used. Generic encyclopedic usage = AI. Specific contextual usage with personal connection = human. Provide examples.>"
    },
    "turing_friction": {
      "connective_tissue_count": <actual number of formal transitions found>,
      "detected_tokens": ["<list each actual connective word found in the text with frequency>"],
      "explanation": "<Explain the density (per 100 words) and placement pattern. High density with regular intervals = AI over-optimization. Low density or varied placement = natural human flow.>"
    }
  },
  "humanization_roadmap": [
    "<TIP 1 - Sentence Variance: 'Break the rhythm by mixing 3-5 word punchy sentences with complex 30+ word sentences. Example: Replace \"[quote sentence from text]\" with \"[rewritten version with different length]\"'>",
    "<TIP 2 - Vocabulary/Transitions: 'Replace formal connectives like \"Moreover\" with casual transitions like \"Plus\" or \"Also\". Remove some transitions entirely. Example: Change \"[quote]\" to \"[rewritten]\"'>",
    "<TIP 3 - Authentic Detail: 'Add specific personal anecdotes, local context, or unique perspectives. Replace generic statements with concrete examples from your experience. Example: Instead of \"[generic statement]\", try \"[specific personal version]\"'>"
  ],
  "verdict_bullets": [
    "<Bullet 1: Key metric supporting verdict, e.g., 'Burstiness score 0.28 indicates mechanical uniformity'>",
    "<Bullet 2: Another supporting metric, e.g., 'Zero contractions or informal language detected'>",
    "<Bullet 3: Final supporting point, e.g., '7 formal transitions in 200 words (3.5 per 100 = over-optimized)'>"
  ],
  "recommendations": [
    "<Recommendation 1 for ${selectedContext} context: Specific advice based on the domain>",
    "<Recommendation 2: Another context-specific suggestion for verification or improvement>"
  ],
  "heatmap_annotations": [
    {
      "start_index": <exact character position where segment starts in original text>,
      "end_index": <exact character position where segment ends>,
      "label": "<AI_PATTERN or HUMAN_PATTERN>",
      "color": "<red if AI_PATTERN, blue if HUMAN_PATTERN>",
      "tooltip_title": "<Short label: 'Robotic Syntax' | 'Formal Transition' | 'Generic Treatment' | 'Human Variance' | 'Informal Voice' | 'Unique Insight'>",
      "tooltip_explanation": "<Detailed explanation of why this specific segment exhibits AI or human patterns. Reference actual metrics or observations.>"
    }
    <Include 5-10 annotations distributed across the text, focusing on the most revealing segments>
  ]
}

# CRITICAL VALIDATION RULES:
1. Score MUST align with verdict (90-100=AI-Generated, 70-89=Hybrid, 50-69=Inconclusive, 0-49=Human)
2. All metrics must be based on actual calculations from the text
3. Heatmap start_index and end_index must reference real character positions
4. Evidence must cite specific examples from the text
5. Humanization tips must include concrete before/after examples

Return ONLY the JSON object. No explanatory text before or after.`;

    // Call Groq API with llama-3.3-70b-versatile model
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
      temperature: 0.3,
      max_tokens: 8192,
      top_p: 0.9
    });

    const rawText = completion.choices[0]?.message?.content || '';
    
    // Clean and parse the response
    const cleanedText = cleanJson(rawText);
    let data: ForensicReportData = JSON.parse(cleanedText);
    
    // POST-PROCESSING VALIDATION: Ensure score matches verdict
    if (data.score >= 90 && data.verdict !== 'Likely AI-Generated') {
      console.warn('Score/verdict mismatch detected. Score:', data.score, 'Verdict:', data.verdict);
      data.verdict = 'Likely AI-Generated';
      data.plain_language_meaning = `This text scores ${data.score}% AI probability, indicating overwhelming AI-generated patterns with minimal human variance.`;
    } else if (data.score >= 70 && data.score < 90 && data.verdict !== 'AI-Assisted (Hybrid)') {
      console.warn('Adjusting verdict to match score range 70-89');
      data.verdict = 'AI-Assisted (Hybrid)';
    } else if (data.score >= 50 && data.score < 70 && data.verdict !== 'Inconclusive (Insufficient Evidence)') {
      console.warn('Adjusting verdict to match score range 50-69');
      data.verdict = 'Inconclusive (Insufficient Evidence)';
    } else if (data.score < 50 && data.verdict !== 'Likely Human-Written') {
      console.warn('Adjusting verdict to match score <50');
      data.verdict = 'Likely Human-Written';
    }

    // Validate heatmap annotations have valid indices
    if (data.heatmap_annotations && data.heatmap_annotations.length > 0) {
      data.heatmap_annotations = data.heatmap_annotations.filter(anno => {
        return anno.start_index >= 0 && 
               anno.end_index <= text.length && 
               anno.start_index < anno.end_index;
      });
    }

    // Ensure minimum heatmap annotations
    if (!data.heatmap_annotations || data.heatmap_annotations.length < 3) {
      console.warn('Insufficient heatmap annotations, generating defaults');
      data.heatmap_annotations = generateDefaultAnnotations(text, data.score);
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
    if (err.message?.includes('JSON')) {
      setError('Analysis returned invalid format. Please try again.');
    } else {
      setError('Analysis failed. Please check your API key or try again.');
    }
  } finally {
    setIsAnalyzing(false);
  }
};

// Helper function to generate fallback heatmap annotations
const generateDefaultAnnotations = (inputText: string, score: number): HeatmapAnnotation[] => {
  const sentences = inputText.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const annotations: HeatmapAnnotation[] = [];
  const isAILikely = score >= 70;
  
  // Annotate first few sentences
  let currentPos = 0;
  for (let i = 0; i < Math.min(5, sentences.length); i++) {
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
      tooltip_title: isAILikely ? "Potential AI Pattern" : "Human-Like Pattern",
      tooltip_explanation: isAILikely 
        ? "This segment exhibits characteristics common in AI-generated text."
        : "This segment shows natural human writing patterns."
    });
  }
  
  return annotations;
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
