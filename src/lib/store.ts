import { create } from 'zustand';

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

interface ResumeState {
  // Session
  sessionId: string | null;
  format: 'long' | 'short';
  brandingMode: 'branded' | 'generic';

  // JD Analysis
  jobDescription: string;
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

  // Actions
  setSessionId: (id: string) => void;
  setFormat: (format: 'long' | 'short') => void;
  setBrandingMode: (mode: 'branded' | 'generic') => void;
  setJobDescription: (jd: string) => void;
  setJDAnalysis: (analysis: {
    targetTitle: string;
    targetCompany: string;
    industry: string;
    keywords: string[];
    themes: string[];
  }) => void;
  setCurrentStep: (step: number) => void;
  setHeader: (header: HeaderData) => void;
  setSummary: (summary: string) => void;
  setHighlights: (highlights: string[], ids: string[]) => void;
  setPosition: (position: PositionData) => void;
  addMessage: (message: Message) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  setIsLoading: (loading: boolean) => void;
  reset: () => void;
}

const initialState = {
  sessionId: null,
  format: 'long' as const,
  brandingMode: 'branded' as const,
  jobDescription: '',
  targetTitle: '',
  targetCompany: '',
  industry: '',
  keywords: [],
  themes: [],
  currentStep: 0,
  header: null,
  summary: '',
  highlights: [],
  highlightIds: [],
  positions: {},
  messages: [],
  isLoading: false,
};

export const useResumeStore = create<ResumeState>((set) => ({
  ...initialState,

  setSessionId: (id) => set({ sessionId: id }),

  setFormat: (format) => set({ format }),

  setBrandingMode: (mode) => set({ brandingMode: mode }),

  setJobDescription: (jd) => set({ jobDescription: jd }),

  setJDAnalysis: (analysis) =>
    set({
      targetTitle: analysis.targetTitle,
      targetCompany: analysis.targetCompany,
      industry: analysis.industry,
      keywords: analysis.keywords,
      themes: analysis.themes,
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

  reset: () => set(initialState),
}));
