import { create } from 'zustand';
import type { JDAnalysis, JDKeyword, KeywordStatus, VerbTracker, GeneratedResume, Gap, QualityScore } from '../types';

export interface Message {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  options?: ContentOption[];
  type?: 'text' | 'options' | 'loading';
}

export interface ContentOption {
  id: string;
  content: string;
  similarity: number;
  selected: boolean;
}

export interface HeaderData {
  name: string;
  title: string;
  location: string;
  phone: string;
  email: string;
}

export interface PositionData {
  number: number;
  title: string;
  company: string;
  location: string;
  dates: string;
  overview: string;
  bullets: string[];
}

// Default verb tracker with initial available verbs
const DEFAULT_VERB_TRACKER: VerbTracker = {
  usedVerbs: {},
  availableVerbs: [
    'Built', 'Developed', 'Created', 'Established', 'Launched', 'Designed',
    'Led', 'Directed', 'Oversaw', 'Managed', 'Headed', 'Guided',
    'Grew', 'Scaled', 'Expanded', 'Increased', 'Accelerated', 'Drove',
    'Transformed', 'Repositioned', 'Modernized', 'Revitalized', 'Redesigned',
    'Architected', 'Defined', 'Shaped', 'Crafted', 'Pioneered', 'Championed',
    'Delivered', 'Executed', 'Implemented', 'Activated', 'Orchestrated'
  ]
};

// Conversation message for section refinements (simplified version of Message)
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ResumeState {
  // Session
  sessionId: string | null;
  format: 'long' | 'short';
  brandingMode: 'branded' | 'generic';
  verbTracker: VerbTracker;

  // JD Analysis (enhanced with keywords)
  jobDescription: string;
  jdAnalysis: JDAnalysis | null;
  // Legacy flat fields for backward compatibility
  targetTitle: string;
  targetCompany: string;
  industry: string;
  keywords: string[];
  themes: string[];

  // Current step (0-8)
  currentStep: number;

  // Approved content
  header: HeaderData | null;
  summary: string;
  highlights: string[];
  highlightIds: string[];
  positions: { [key: number]: PositionData };

  // Chat
  messages: Message[];
  isLoading: boolean;

  // Conversation history per section (for multi-turn refinements)
  conversationHistory: Record<string, ConversationMessage[]>;

  // V1.5 One-Shot Generation
  generatedResume: GeneratedResume | null;
  gaps: Gap[];
  qualityScore: QualityScore | null;
  isGenerating: boolean;

  // Actions
  setSessionId: (id: string) => void;
  setFormat: (format: 'long' | 'short') => void;
  setBrandingMode: (mode: 'branded' | 'generic') => void;
  setJobDescription: (jd: string) => void;
  setJDAnalysis: (analysis: {
    strategic?: {
      targetTitle: string;
      targetCompany: string;
      industry: string;
      positioningThemes: string[];
    };
    keywords?: JDKeyword[];
    // Legacy flat fields
    targetTitle?: string;
    targetCompany?: string;
    industry?: string;
    themes?: string[];
  }) => void;
  updateKeywordStatus: (
    keywordId: string,
    status: KeywordStatus,
    metadata?: { sectionAddressed?: string; userContext?: string; dismissReason?: string }
  ) => void;
  setCurrentStep: (step: number) => void;
  setHeader: (header: HeaderData) => void;
  setSummary: (summary: string) => void;
  setHighlights: (highlights: string[], ids: string[]) => void;
  setPosition: (position: PositionData) => void;
  addMessage: (message: Message) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  setIsLoading: (loading: boolean) => void;
  setVerbTracker: (tracker: VerbTracker) => void;
  updateUsedVerbs: (verb: string, section: string) => void;
  addConversationMessage: (section: string, message: ConversationMessage) => void;
  clearSectionHistory: (section: string) => void;
  // V1.5 Actions
  setGeneratedResume: (resume: GeneratedResume) => void;
  setGaps: (gaps: Gap[]) => void;
  setQualityScore: (score: QualityScore) => void;
  updateGapStatus: (gapId: string, status: 'addressed' | 'skipped') => void;
  setIsGenerating: (generating: boolean) => void;
  clearGeneration: () => void;
  reset: () => void;
}

const initialState = {
  sessionId: null,
  format: 'long' as const,
  brandingMode: 'branded' as const,
  verbTracker: DEFAULT_VERB_TRACKER,
  jobDescription: '',
  jdAnalysis: null as JDAnalysis | null,
  targetTitle: '',
  targetCompany: '',
  industry: '',
  keywords: [] as string[],
  themes: [] as string[],
  currentStep: 0,
  header: null as HeaderData | null,
  summary: '',
  highlights: [] as string[],
  highlightIds: [] as string[],
  positions: {} as { [key: number]: PositionData },
  messages: [] as Message[],
  isLoading: false,
  conversationHistory: {} as Record<string, ConversationMessage[]>,
  // V1.5 One-Shot Generation
  generatedResume: null as GeneratedResume | null,
  gaps: [] as Gap[],
  qualityScore: null as QualityScore | null,
  isGenerating: false,
};

export const useResumeStore = create<ResumeState>((set) => ({
  ...initialState,

  setSessionId: (id) => set({ sessionId: id }),

  setFormat: (format) => set({ format }),

  setBrandingMode: (mode) => set({ brandingMode: mode }),

  setJobDescription: (jd) => set({ jobDescription: jd }),

  setJDAnalysis: (analysis) => {
    // Handle both new structured format and legacy flat format
    if (analysis.strategic && analysis.keywords) {
      // New format with strategic + keywords
      set({
        jdAnalysis: {
          strategic: analysis.strategic,
          keywords: analysis.keywords,
        },
        // Also set legacy fields for backward compatibility
        targetTitle: analysis.strategic.targetTitle,
        targetCompany: analysis.strategic.targetCompany,
        industry: analysis.strategic.industry,
        keywords: analysis.keywords.map((k) => k.keyword),
        themes: analysis.strategic.positioningThemes,
      });
    } else {
      // Legacy flat format
      set({
        targetTitle: analysis.targetTitle || '',
        targetCompany: analysis.targetCompany || '',
        industry: analysis.industry || '',
        keywords: analysis.themes || [], // themes used to be keywords in legacy
        themes: analysis.themes || [],
      });
    }
  },

  updateKeywordStatus: (keywordId, status, metadata) =>
    set((state) => {
      if (!state.jdAnalysis) return state;

      const updatedKeywords = state.jdAnalysis.keywords.map((k) =>
        k.id === keywordId
          ? {
              ...k,
              status,
              ...(metadata?.sectionAddressed && { sectionAddressed: metadata.sectionAddressed }),
              ...(metadata?.userContext && { userContext: metadata.userContext }),
              ...(metadata?.dismissReason && { dismissReason: metadata.dismissReason }),
            }
          : k
      );

      return {
        jdAnalysis: {
          ...state.jdAnalysis,
          keywords: updatedKeywords,
        },
      };
    }),

  setCurrentStep: (step) => set({ currentStep: step }),

  setHeader: (header) => set({ header }),

  setSummary: (summary) => set({ summary }),

  setHighlights: (highlights, ids) =>
    set({ highlights, highlightIds: ids }),

  setPosition: (position) =>
    set((state) => ({
      positions: {
        ...state.positions,
        [position.number]: position,
      },
    })),

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),

  updateMessage: (id, updates) =>
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === id ? { ...msg, ...updates } : msg
      ),
    })),

  setIsLoading: (loading) => set({ isLoading: loading }),

  setVerbTracker: (tracker) => set({ verbTracker: tracker }),

  updateUsedVerbs: (verb, section) =>
    set((state) => {
      const currentSections = state.verbTracker.usedVerbs[verb] || [];
      if (currentSections.includes(section)) return state; // Already tracked

      return {
        verbTracker: {
          ...state.verbTracker,
          usedVerbs: {
            ...state.verbTracker.usedVerbs,
            [verb]: [...currentSections, section],
          },
        },
      };
    }),

  addConversationMessage: (section, message) =>
    set((state) => ({
      conversationHistory: {
        ...state.conversationHistory,
        [section]: [...(state.conversationHistory[section] || []), message],
      },
    })),

  clearSectionHistory: (section) =>
    set((state) => ({
      conversationHistory: {
        ...state.conversationHistory,
        [section]: [],
      },
    })),

  // V1.5 Actions
  setGeneratedResume: (resume) => set({ generatedResume: resume }),

  setGaps: (gaps) => set({ gaps }),

  setQualityScore: (score) => set({ qualityScore: score }),

  updateGapStatus: (gapId, status) =>
    set((state) => ({
      gaps: state.gaps.map((gap) =>
        gap.id === gapId ? { ...gap, status } : gap
      ),
    })),

  setIsGenerating: (generating) => set({ isGenerating: generating }),

  clearGeneration: () =>
    set({
      generatedResume: null,
      gaps: [],
      qualityScore: null,
      isGenerating: false,
    }),

  reset: () => set(initialState),
}));
