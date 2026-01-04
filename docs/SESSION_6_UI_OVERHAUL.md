# Session 6: UI Overhaul

> **Time**: 60 minutes
> **Scope**: Replace 8-step wizard with single-page generate → review flow
> **Builds on**: Sessions 1-5

---

## Context

This is the most visible change. We're replacing the multi-step wizard with:
1. Single input page (paste JD → generate)
2. Review page (full resume + gaps + quality + chat refinement)

---

## Current UI Flow (V1)
```
Step 1: Format → Step 2: JD → Step 3: Header → Step 4: Summary → 
Step 5: Highlights → Step 6: P1 → Step 7: P2 → Step 8: P3-6 → Export
```

## New UI Flow (V1.5)
```
Page 1: Paste JD → [Generate Resume]
                ↓
Page 2: Full Resume Preview | Gaps Panel | Quality Score | Chat Refinement
                ↓
        [Export DOCX]
```

---

## Task 1: Create One-Shot Input Component

**File**: `src/components/resume/OneShotInput.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';

interface OneShotInputProps {
  onGenerate: (jobDescription: string, format: 'long' | 'short') => Promise<void>;
  isLoading: boolean;
}

export function OneShotInput({ onGenerate, isLoading }: OneShotInputProps) {
  const [jobDescription, setJobDescription] = useState('');
  const [format, setFormat] = useState<'long' | 'short'>('long');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobDescription.trim() || isLoading) return;
    await onGenerate(jobDescription, format);
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          ResumeOS
        </h1>
        <p className="text-gray-600">
          Paste a job description and get a tailored resume in seconds
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Format Selection */}
        <div className="flex justify-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="format"
              value="long"
              checked={format === 'long'}
              onChange={() => setFormat('long')}
              className="w-4 h-4 text-blue-600"
            />
            <span className={format === 'long' ? 'font-medium' : 'text-gray-600'}>
              Long Format
            </span>
            <span className="text-xs text-gray-400">(with bullets)</span>
          </label>
          
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="format"
              value="short"
              checked={format === 'short'}
              onChange={() => setFormat('short')}
              className="w-4 h-4 text-blue-600"
            />
            <span className={format === 'short' ? 'font-medium' : 'text-gray-600'}>
              Short Format
            </span>
            <span className="text-xs text-gray-400">(overviews only)</span>
          </label>
        </div>

        {/* Job Description Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Job Description
          </label>
          <textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the full job description here..."
            className="w-full h-64 p-4 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />
        </div>

        {/* Generate Button */}
        <button
          type="submit"
          disabled={!jobDescription.trim() || isLoading}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Generating Resume...
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5" />
              Generate Resume
            </>
          )}
        </button>

        {isLoading && (
          <p className="text-center text-sm text-gray-500">
            Analyzing job description and tailoring your resume. This takes 15-30 seconds.
          </p>
        )}
      </form>
    </div>
  );
}
```

---

## Task 2: Create One-Shot Review Component

**File**: `src/components/resume/OneShotReview.tsx`

```typescript
'use client';

import { useState } from 'react';
import { GeneratedResume, Gap, QualityScore } from '@/types';
import { GapRecommendations } from './GapRecommendations';
import { QualityIndicator } from './QualityIndicator';
import { ResumePreview } from './ResumePreview';
import { ChatRefinement } from './ChatRefinement';
import { Download, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

interface OneShotReviewProps {
  sessionId: string;
  resume: GeneratedResume;
  gaps: Gap[];
  qualityScore: QualityScore;
  targetTitle: string;
  targetCompany: string;
  onResumeUpdate: (resume: GeneratedResume) => void;
  onGapsUpdate: (gaps: Gap[]) => void;
  onRegenerate: () => void;
  onExport: () => void;
  isExporting: boolean;
}

export function OneShotReview({
  sessionId,
  resume,
  gaps,
  qualityScore,
  targetTitle,
  targetCompany,
  onResumeUpdate,
  onGapsUpdate,
  onRegenerate,
  onExport,
  isExporting,
}: OneShotReviewProps) {
  const [showQualityDetails, setShowQualityDetails] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const openGaps = gaps.filter(g => g.status === 'open');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              Resume for {targetTitle}
            </h1>
            <p className="text-sm text-gray-500">{targetCompany}</p>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={onRegenerate}
              className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <RefreshCw className="h-4 w-4" />
              Regenerate
            </button>
            
            <button
              onClick={onExport}
              disabled={isExporting}
              className="flex items-center gap-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {isExporting ? 'Exporting...' : 'Export DOCX'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: Resume Preview */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <ResumePreview 
                resume={resume} 
                onSectionClick={setActiveSection}
                activeSection={activeSection}
              />
            </div>
          </div>

          {/* Right Column: Panels */}
          <div className="space-y-4">
            
            {/* Quality Score */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div 
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setShowQualityDetails(!showQualityDetails)}
              >
                <h3 className="font-medium text-gray-900">Quality Score</h3>
                {showQualityDetails ? (
                  <ChevronUp className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                )}
              </div>
              <div className="mt-3">
                <QualityIndicator 
                  score={qualityScore} 
                  showDetails={showQualityDetails} 
                />
              </div>
            </div>

            {/* Gap Recommendations */}
            {openGaps.length > 0 && (
              <GapRecommendations
                gaps={gaps}
                sessionId={sessionId}
                onGapAddressed={onGapsUpdate}
                onResumeUpdated={onResumeUpdate}
              />
            )}

            {/* Chat Refinement */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h3 className="font-medium text-gray-900 mb-3">Refine via Chat</h3>
              <ChatRefinement
                sessionId={sessionId}
                activeSection={activeSection}
                onResumeUpdate={onResumeUpdate}
              />
            </div>

            {/* Theme Coverage */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h3 className="font-medium text-gray-900 mb-3">Theme Coverage</h3>
              <div className="space-y-2">
                {resume.themes_addressed?.map((theme, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="w-2 h-2 bg-green-500 rounded-full" />
                    <span className="text-gray-700">{theme}</span>
                  </div>
                ))}
                {resume.themes_not_addressed?.map((theme, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="w-2 h-2 bg-red-400 rounded-full" />
                    <span className="text-gray-500">{theme}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## Task 3: Create Resume Preview Component

**File**: `src/components/resume/ResumePreview.tsx`

```typescript
'use client';

import { GeneratedResume } from '@/types';
import { renderContent } from '@/lib/render-highlights';

interface ResumePreviewProps {
  resume: GeneratedResume;
  onSectionClick?: (section: string) => void;
  activeSection?: string | null;
  showHighlights?: boolean;
}

export function ResumePreview({ 
  resume, 
  onSectionClick,
  activeSection,
  showHighlights = false 
}: ResumePreviewProps) {
  
  const sectionClass = (section: string) => `
    cursor-pointer rounded p-2 -m-2 transition-colors
    ${activeSection === section ? 'bg-blue-50 ring-2 ring-blue-300' : 'hover:bg-gray-50'}
  `;

  return (
    <div className="prose prose-sm max-w-none">
      {/* Header */}
      <div className="text-center border-b pb-4 mb-4">
        <h1 className="text-2xl font-bold mb-1">Umberto Castaldo</h1>
        <p className="text-lg text-gray-700">
          {resume.positions[0]?.title || 'Brand Strategy Executive'}
        </p>
        <p className="text-sm text-gray-500">
          New York, NY | umberto@example.com
        </p>
      </div>

      {/* Summary */}
      <div 
        className={sectionClass('summary')}
        onClick={() => onSectionClick?.('summary')}
      >
        <p className="text-gray-800 leading-relaxed">
          {showHighlights 
            ? renderContent({ content: resume.summary, showHighlights: true })
            : resume.summary
          }
        </p>
      </div>

      {/* Career Highlights */}
      <div className="mt-6">
        <h2 className="text-sm font-bold uppercase tracking-wide border-b pb-1 mb-3">
          Career Highlights
        </h2>
        <ul className="space-y-2">
          {resume.career_highlights.map((highlight, index) => (
            <li 
              key={index}
              className={sectionClass(`highlight_${index + 1}`)}
              onClick={() => onSectionClick?.(`highlight_${index + 1}`)}
            >
              {showHighlights
                ? renderContent({ content: highlight, showHighlights: true })
                : highlight
              }
            </li>
          ))}
        </ul>
      </div>

      {/* Professional Experience */}
      <div className="mt-6">
        <h2 className="text-sm font-bold uppercase tracking-wide border-b pb-1 mb-3">
          Professional Experience
        </h2>
        
        {resume.positions.map((position) => (
          <div key={position.number} className="mb-6">
            {/* Position Header */}
            <div className="flex justify-between items-baseline mb-1">
              <h3 className="font-bold text-gray-900">{position.title}</h3>
              <span className="text-sm text-gray-500">{position.dates}</span>
            </div>
            <p className="text-gray-600 text-sm mb-2">
              {position.company} | {position.location}
            </p>

            {/* Overview */}
            <div
              className={sectionClass(`position_${position.number}_overview`)}
              onClick={() => onSectionClick?.(`position_${position.number}_overview`)}
            >
              <p className="text-gray-700">
                {showHighlights
                  ? renderContent({ content: position.overview, showHighlights: true })
                  : position.overview
                }
              </p>
            </div>

            {/* Bullets */}
            {position.bullets && position.bullets.length > 0 && (
              <ul className="mt-2 space-y-2">
                {position.bullets.map((bullet, bulletIndex) => (
                  <li
                    key={bulletIndex}
                    className={sectionClass(`position_${position.number}_bullet_${bulletIndex + 1}`)}
                    onClick={() => onSectionClick?.(`position_${position.number}_bullet_${bulletIndex + 1}`)}
                  >
                    {showHighlights
                      ? renderContent({ content: bullet, showHighlights: true })
                      : bullet
                    }
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      {/* Education */}
      <div className="mt-6">
        <h2 className="text-sm font-bold uppercase tracking-wide border-b pb-1 mb-3">
          Education
        </h2>
        <p className="text-gray-700">
          <strong>Marist College</strong>: Bachelor of Business Administration | 
          Business Management & Marketing Communications
        </p>
      </div>
    </div>
  );
}
```

---

## Task 4: Create Chat Refinement Component

**File**: `src/components/resume/ChatRefinement.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';

interface ChatRefinementProps {
  sessionId: string;
  activeSection: string | null;
  onResumeUpdate: (resume: any) => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function ChatRefinement({ 
  sessionId, 
  activeSection, 
  onResumeUpdate 
}: ChatRefinementProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          section: activeSection || 'summary',
          instruction: userMessage,
          conversationHistory: messages,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `Updated ${activeSection || 'content'}. ${data.refined_content.slice(0, 100)}...` 
        }]);
        onResumeUpdate(data.resume);
      } else {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `Error: ${data.error}` 
        }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Failed to refine. Please try again.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {activeSection ? (
        <p className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
          Refining: {activeSection.replace(/_/g, ' ')}
        </p>
      ) : (
        <p className="text-xs text-gray-500">
          Click a section in the preview to select it for refinement
        </p>
      )}

      {/* Message History */}
      {messages.length > 0 && (
        <div className="max-h-40 overflow-y-auto space-y-2 text-sm">
          {messages.slice(-4).map((msg, i) => (
            <div 
              key={i}
              className={`p-2 rounded ${
                msg.role === 'user' 
                  ? 'bg-blue-50 text-blue-800' 
                  : 'bg-gray-50 text-gray-800'
              }`}
            >
              {msg.content}
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="e.g., Make it more concise..."
          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={isLoading}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
```

---

## Task 5: Update Main Page

**File**: `src/app/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { OneShotInput } from '@/components/resume/OneShotInput';
import { OneShotReview } from '@/components/resume/OneShotReview';
import { GeneratedResume, Gap, QualityScore } from '@/types';

export default function Home() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [resume, setResume] = useState<GeneratedResume | null>(null);
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [qualityScore, setQualityScore] = useState<QualityScore | null>(null);
  const [targetTitle, setTargetTitle] = useState('');
  const [targetCompany, setTargetCompany] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleGenerate = async (jobDescription: string, format: 'long' | 'short') => {
    setIsLoading(true);

    try {
      // Step 1: Create session and analyze JD
      const analyzeResponse = await fetch('/api/analyze-jd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription, format }),
      });
      
      const analyzeData = await analyzeResponse.json();
      
      if (!analyzeData.success) {
        throw new Error(analyzeData.error);
      }

      setSessionId(analyzeData.sessionId);
      setTargetTitle(analyzeData.analysis.target_title);
      setTargetCompany(analyzeData.analysis.target_company);

      // Step 2: Generate full resume
      const generateResponse = await fetch('/api/generate-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: analyzeData.sessionId }),
      });

      const generateData = await generateResponse.json();

      if (!generateData.success) {
        throw new Error(generateData.error);
      }

      setResume(generateData.resume);
      setGaps(generateData.gaps || []);
      setQualityScore(generateData.quality_score);

    } catch (error) {
      console.error('Generation failed:', error);
      alert('Failed to generate resume. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (!sessionId) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/generate-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

      const data = await response.json();

      if (data.success) {
        setResume(data.resume);
        setGaps(data.gaps || []);
        setQualityScore(data.quality_score);
      }
    } catch (error) {
      console.error('Regeneration failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    if (!sessionId) return;

    setIsExporting(true);
    try {
      const response = await fetch('/api/export-docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Resume_${targetCompany.replace(/\s+/g, '_')}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // Show input page if no resume generated yet
  if (!resume) {
    return <OneShotInput onGenerate={handleGenerate} isLoading={isLoading} />;
  }

  // Show review page
  return (
    <OneShotReview
      sessionId={sessionId!}
      resume={resume}
      gaps={gaps}
      qualityScore={qualityScore!}
      targetTitle={targetTitle}
      targetCompany={targetCompany}
      onResumeUpdate={setResume}
      onGapsUpdate={setGaps}
      onRegenerate={handleRegenerate}
      onExport={handleExport}
      isExporting={isExporting}
    />
  );
}
```

---

## Task 6: Update DOCX Export Route

**File**: `src/app/api/export-docx/route.ts`

Update to use the new `generated_resume` structure:

```typescript
// Modify the export to read from generated_resume instead of individual approved_ fields

const session = sessionResult.rows[0];
const resume = session.generated_resume as GeneratedResume;

if (!resume) {
  return NextResponse.json(
    { error: 'No resume generated yet' },
    { status: 400 }
  );
}

// Use resume.summary, resume.career_highlights, resume.positions
// instead of session.approved_summary, etc.
```

---

## Commit

```bash
git add .
git commit -m "feat: replace step wizard with one-shot generate and review UI"
```

---

## Update HANDOFF.md

```markdown
## Session 6 Complete: UI Overhaul

**What was done**:
- Created OneShotInput component (JD paste → generate)
- Created OneShotReview component (full resume preview + panels)
- Created ResumePreview component (clickable sections)
- Created ChatRefinement component (per-section refinement)
- Updated main page to use new flow
- Updated DOCX export to use generated_resume

**New UI flow**:
1. Paste JD → Select format → Generate
2. See complete resume + quality score + gaps
3. Click section to refine via chat
4. Address/skip gaps
5. Export DOCX

**Files changed**:
- src/components/resume/OneShotInput.tsx (new)
- src/components/resume/OneShotReview.tsx (new)
- src/components/resume/ResumePreview.tsx (new)
- src/components/resume/ChatRefinement.tsx (new)
- src/app/page.tsx (rewritten)
- src/app/api/export-docx/route.ts (modified)

**V1.5 Complete!**
```

---

## Success Criteria

- [ ] Can paste JD and click "Generate Resume"
- [ ] Full resume appears after ~20 seconds
- [ ] Quality score visible
- [ ] Gaps panel shows (if any gaps exist)
- [ ] Can click sections to select for refinement
- [ ] Chat refinement works for selected section
- [ ] Export DOCX works
- [ ] Regenerate button works

---

## Final Testing

After all sessions complete:

1. **Fresh start test**
   - Go to app
   - Paste an Anthropic JD
   - Generate
   - Check quality score
   - Check for gaps
   - Try refining summary
   - Export DOCX

2. **Quality test**
   - Open exported DOCX
   - Check bullet length (<40 words)
   - Check verb variety
   - Check for jargon
   - Read aloud — does it sound natural?

3. **Regression test**
   - Ensure old V1 routes still work (backward compat)
