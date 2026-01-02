'use client';

import { useCallback, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ProgressBar } from './ProgressBar';
import { ChatPanel } from './ChatPanel';
import { PreviewPanel } from './PreviewPanel';
import { useResumeStore } from '@/lib/store';
import { STATIC_CONTENT, POSITIONS } from '@/lib/rules';
import { Button } from '@/components/ui/button';
import type { JDKeyword } from '@/types';

export function ResumeBuilder() {
  const store = useResumeStore();
  const [currentMissingKeyword, setCurrentMissingKeyword] = useState<JDKeyword | null>(null);
  const [missingKeywordsQueue, setMissingKeywordsQueue] = useState<JDKeyword[]>([]);
  const [isKeywordLoading, setIsKeywordLoading] = useState(false);
  const [pendingContent, setPendingContent] = useState<string | null>(null);

  const handleSendMessage = useCallback(
    async (content: string) => {
      // Add user message
      store.addMessage({
        id: uuidv4(),
        role: 'user',
        content,
      });

      store.setIsLoading(true);

      try {
        switch (store.currentStep) {
          case 0:
            await handleFormatSelection(content, store);
            break;
          case 1:
            await handleJDAnalysis(content, store);
            break;
          case 2:
            await handleHeaderConfirmation(content, store);
            break;
          case 3:
            await handleSummaryGeneration(content, store);
            break;
          case 4:
            await handleHighlightsSelection(content, store);
            break;
          case 5:
            await handlePosition1(content, store);
            break;
          case 6:
            await handlePosition2(content, store);
            break;
          case 7:
            await handlePositions3to6(content, store);
            break;
          default:
            store.addMessage({
              id: uuidv4(),
              role: 'assistant',
              content: 'Resume is complete! Click Export to download your tailored resume.',
            });
        }
      } catch (error) {
        console.error('Error:', error);
        store.addMessage({
          id: uuidv4(),
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again.',
        });
      } finally {
        store.setIsLoading(false);
      }
    },
    [store]
  );

  const handleApprove = useCallback(async () => {
    store.setIsLoading(true);

    try {
      // Approve current section and move to next step
      const response = await fetch('/api/approve-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: store.sessionId,
          sectionType: getSectionType(store.currentStep),
          content: getCurrentContent(store),
          contentIds: store.currentStep === 4 ? store.highlightIds : undefined,
          positionData: store.currentStep >= 5 && store.currentStep <= 7
            ? store.positions[store.currentStep - 4]
            : undefined,
        }),
      });

      if (response.ok) {
        const nextStep = store.currentStep + 1;
        store.setCurrentStep(nextStep);

        // Trigger next step
        await triggerNextStep(nextStep, store);
      }
    } catch (error) {
      console.error('Error approving:', error);
    } finally {
      store.setIsLoading(false);
    }
  }, [store]);

  const handleExport = useCallback(async () => {
    store.setIsLoading(true);

    try {
      const response = await fetch('/api/export-docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: store.sessionId }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${STATIC_CONTENT.header.name.replace(/\s+/g, '_')}_Resume.docx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        store.addMessage({
          id: uuidv4(),
          role: 'assistant',
          content: '✅ Resume exported successfully! Check your downloads folder.',
        });
      }
    } catch (error) {
      console.error('Error exporting:', error);
      store.addMessage({
        id: uuidv4(),
        role: 'assistant',
        content: 'Sorry, failed to export the resume. Please try again.',
      });
    } finally {
      store.setIsLoading(false);
    }
  }, [store]);

  // Keyword action handlers
  const handleKeywordAdd = useCallback(
    async (keywordId: string, userContext: string) => {
      if (!pendingContent) return;

      setIsKeywordLoading(true);

      try {
        const response = await fetch('/api/keyword-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: store.sessionId,
            keywordId,
            action: 'add',
            userContext,
            currentContent: pendingContent,
            sectionType: getSectionType(store.currentStep),
          }),
        });

        const data = await response.json();

        if (data.success) {
          // Update store keyword status
          store.updateKeywordStatus(keywordId, 'addressed', {
            sectionAddressed: getSectionType(store.currentStep),
            userContext,
          });

          // Update content with regenerated version
          if (data.regeneratedContent) {
            if (store.currentStep === 3) {
              store.setSummary(data.regeneratedContent);
              setPendingContent(data.regeneratedContent);
            }
          }

          // Move to next keyword or allow approval
          const remainingQueue = missingKeywordsQueue.filter((k) => k.id !== keywordId);
          setMissingKeywordsQueue(remainingQueue);
          setCurrentMissingKeyword(remainingQueue[0] || null);

          if (remainingQueue.length === 0) {
            store.addMessage({
              id: uuidv4(),
              role: 'assistant',
              content: 'All JD keywords have been addressed. Click **Approve** to continue.',
            });
          }
        }
      } catch (error) {
        console.error('Error adding keyword:', error);
      } finally {
        setIsKeywordLoading(false);
      }
    },
    [store, pendingContent, missingKeywordsQueue]
  );

  const handleKeywordSkip = useCallback(
    (keywordId: string) => {
      store.updateKeywordStatus(keywordId, 'skipped');

      const remainingQueue = missingKeywordsQueue.filter((k) => k.id !== keywordId);
      setMissingKeywordsQueue(remainingQueue);
      setCurrentMissingKeyword(remainingQueue[0] || null);

      if (remainingQueue.length === 0) {
        store.addMessage({
          id: uuidv4(),
          role: 'assistant',
          content: 'Skipped keywords will be revisited in later sections. Click **Approve** to continue.',
        });
      }
    },
    [store, missingKeywordsQueue]
  );

  const handleKeywordDismiss = useCallback(
    async (keywordId: string) => {
      setIsKeywordLoading(true);

      try {
        await fetch('/api/keyword-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: store.sessionId,
            keywordId,
            action: 'dismiss',
          }),
        });

        store.updateKeywordStatus(keywordId, 'dismissed', {
          dismissReason: "User indicated they don't have this skill",
        });

        const remainingQueue = missingKeywordsQueue.filter((k) => k.id !== keywordId);
        setMissingKeywordsQueue(remainingQueue);
        setCurrentMissingKeyword(remainingQueue[0] || null);

        if (remainingQueue.length === 0) {
          store.addMessage({
            id: uuidv4(),
            role: 'assistant',
            content: 'All remaining keywords handled. Click **Approve** to continue.',
          });
        }
      } catch (error) {
        console.error('Error dismissing keyword:', error);
      } finally {
        setIsKeywordLoading(false);
      }
    },
    [store, missingKeywordsQueue]
  );

  // Initialize with welcome message
  if (store.messages.length === 0) {
    store.addMessage({
      id: uuidv4(),
      role: 'assistant',
      content: `Welcome to ResumeOS! I'll help you create a tailored resume.

First, choose your format:
• **Long format** - Full overview + bullets for positions 1-2
• **Short format** - Concise overviews only, no bullets

Type "long" or "short" to begin.`,
    });
  }

  return (
    <div className="flex flex-col h-screen bg-zinc-950">
      {/* Progress bar */}
      <ProgressBar currentStep={store.currentStep} />

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat panel - left 40% */}
        <div className="w-[40%] border-r border-zinc-800">
          <ChatPanel
            onSendMessage={handleSendMessage}
            onApprove={store.currentStep > 0 && store.currentStep < 8 ? handleApprove : undefined}
            currentMissingKeyword={currentMissingKeyword}
            onKeywordAdd={handleKeywordAdd}
            onKeywordSkip={handleKeywordSkip}
            onKeywordDismiss={handleKeywordDismiss}
            isKeywordLoading={isKeywordLoading}
          />
        </div>

        {/* Preview panel - right 60% */}
        <div className="w-[60%]">
          <PreviewPanel />
        </div>
      </div>

      {/* Export button (shown at step 8) */}
      {store.currentStep >= 8 && (
        <div className="border-t border-zinc-800 p-4 bg-zinc-900">
          <div className="max-w-4xl mx-auto flex justify-center">
            <Button
              onClick={handleExport}
              disabled={store.isLoading}
              className="bg-green-600 hover:bg-green-700 text-lg px-8 py-6"
            >
              {store.isLoading ? 'Exporting...' : 'Export Resume (.docx)'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Step handlers
async function handleFormatSelection(content: string, store: ReturnType<typeof useResumeStore.getState>) {
  const format = content.toLowerCase().includes('long') ? 'long' : 'short';
  store.setFormat(format);

  store.addMessage({
    id: uuidv4(),
    role: 'assistant',
    content: `Great! Using **${format} format**.

Now paste the job description you're applying for. I'll analyze it to find the most relevant content for your resume.`,
  });

  store.setCurrentStep(1);
}

async function handleJDAnalysis(content: string, store: ReturnType<typeof useResumeStore.getState>) {
  store.setJobDescription(content);

  store.addMessage({
    id: uuidv4(),
    role: 'assistant',
    content: 'Analyzing the job description...',
  });

  const response = await fetch('/api/analyze-jd', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobDescription: content }),
  });

  const data = await response.json();

  if (data.sessionId) {
    store.setSessionId(data.sessionId);
    store.setJDAnalysis(data.analysis);
    store.setBrandingMode(data.analysis.recommendedBrandingMode);

    // Format keywords by category for display
    const keywordsByCategory = data.analysis.keywords?.reduce(
      (acc: Record<string, string[]>, k: JDKeyword) => {
        const cat = k.category === 'hard_skill' ? 'Hard Skills' :
                   k.category === 'soft_skill' ? 'Soft Skills' :
                   k.category === 'industry_term' ? 'Industry Terms' : 'Seniority';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(k.keyword);
        return acc;
      },
      {}
    ) || {};

    const keywordsDisplay = Object.entries(keywordsByCategory)
      .map(([cat, kws]) => `• **${cat}:** ${(kws as string[]).slice(0, 5).join(', ')}`)
      .join('\n');

    store.addMessage({
      id: uuidv4(),
      role: 'assistant',
      content: `Analysis complete!

**Target Role:** ${data.analysis.targetTitle || data.analysis.strategic?.targetTitle}
**Company:** ${data.analysis.targetCompany || data.analysis.strategic?.targetCompany}
**Industry:** ${data.analysis.industry || data.analysis.strategic?.industry}

**Positioning Themes:**
${(data.analysis.themes || data.analysis.strategic?.positioningThemes || []).map((t: string) => `• ${t}`).join('\n')}

**ATS Keywords (${data.analysis.keywords?.length || 0} extracted):**
${keywordsDisplay}

${data.analysis.recommendedBrandingMode === 'generic' ? '⚠️ Using generic branding (competitor detected)' : ''}

Does this look right? Type "yes" to continue or provide corrections.`,
    });

    store.setCurrentStep(2);
  }
}

async function handleHeaderConfirmation(content: string, store: ReturnType<typeof useResumeStore.getState>) {
  const header = {
    name: STATIC_CONTENT.header.name,
    title: store.targetTitle || 'Brand Strategist',
    location: STATIC_CONTENT.header.location,
    phone: STATIC_CONTENT.header.phone,
    email: STATIC_CONTENT.header.email,
  };

  store.setHeader(header);

  store.addMessage({
    id: uuidv4(),
    role: 'assistant',
    content: `Header confirmed with title: **${header.title}**

Now generating your tailored summary...`,
  });

  // Auto-advance to summary
  store.setCurrentStep(3);
  await generateSummary(store);
}

async function generateSummary(
  store: ReturnType<typeof useResumeStore.getState>,
  setMissingKeywordsQueue?: (keywords: JDKeyword[]) => void,
  setCurrentMissingKeyword?: (keyword: JDKeyword | null) => void,
  setPendingContent?: (content: string) => void
) {
  const response = await fetch('/api/generate-section', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: store.sessionId,
      sectionType: 'summary',
    }),
  });

  const data = await response.json();

  if (data.draft) {
    store.setSummary(data.draft);

    // Update addressed keywords in store
    if (data.addressedKeywordIds && data.addressedKeywordIds.length > 0) {
      data.addressedKeywordIds.forEach((id: string) => {
        store.updateKeywordStatus(id, 'addressed', { sectionAddressed: 'summary' });
      });
    }

    // Handle missing keywords for gap reconciliation
    if (data.missingKeywords && data.missingKeywords.length > 0 && setMissingKeywordsQueue && setCurrentMissingKeyword && setPendingContent) {
      setMissingKeywordsQueue(data.missingKeywords);
      setCurrentMissingKeyword(data.missingKeywords[0]);
      setPendingContent(data.draft);

      store.addMessage({
        id: uuidv4(),
        role: 'assistant',
        content: `Here's your tailored summary:

"${data.draft}"

${data.missingKeywords.length} JD keywords weren't naturally included. Let's see if any can be added.`,
      });
    } else {
      store.addMessage({
        id: uuidv4(),
        role: 'assistant',
        content: `Here's your tailored summary:

"${data.draft}"

Click **Approve** to continue, or suggest changes.`,
      });
    }
  }
}

async function handleSummaryGeneration(content: string, store: ReturnType<typeof useResumeStore.getState>) {
  // User is providing feedback - regenerate
  const response = await fetch('/api/generate-section', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: store.sessionId,
      sectionType: 'summary',
      instructions: content,
    }),
  });

  const data = await response.json();

  if (data.draft) {
    store.setSummary(data.draft);

    store.addMessage({
      id: uuidv4(),
      role: 'assistant',
      content: `Updated summary:

"${data.draft}"

Click **Approve** to continue, or suggest more changes.`,
    });
  }
}

async function handleHighlightsSelection(content: string, store: ReturnType<typeof useResumeStore.getState>) {
  // Search for career highlights
  const response = await fetch('/api/search-content', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: store.sessionId,
      contentType: 'career_highlight',
      limit: 8,
    }),
  });

  const data = await response.json();

  if (data.results) {
    // Auto-select top 5
    const top5 = data.results.slice(0, 5);
    const ids = top5.map((r: { id: string }) => r.id);

    // Tailor highlights with keywords
    const tailorResponse = await fetch('/api/generate-section', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: store.sessionId,
        sectionType: 'career_highlight',
        contentIds: ids,
      }),
    });

    const tailorData = await tailorResponse.json();

    // Parse the tailored content (comes as bullet points separated by newlines)
    const tailoredHighlights = tailorData.draft
      ? tailorData.draft.split('\n').filter((h: string) => h.trim()).map((h: string) => h.replace(/^[•\-]\s*/, ''))
      : top5.map((r: { content: string }) => r.content);

    store.setHighlights(tailoredHighlights, ids);

    // Update addressed keywords
    if (tailorData.addressedKeywordIds && tailorData.addressedKeywordIds.length > 0) {
      tailorData.addressedKeywordIds.forEach((id: string) => {
        store.updateKeywordStatus(id, 'addressed', { sectionAddressed: 'highlights' });
      });
    }

    store.addMessage({
      id: uuidv4(),
      role: 'assistant',
      content: `Here are the top 5 career highlights tailored for the JD:

${tailoredHighlights.map((h: string, i: number) => `${i + 1}. ${h}`).join('\n\n')}

These are automatically selected. Click **Approve** to continue, or tell me which ones to swap.`,
    });
  }
}

async function handlePosition1(content: string, store: ReturnType<typeof useResumeStore.getState>) {
  const posConfig = POSITIONS[0];
  const currentPosition = store.positions[1];

  // If user is providing refinement feedback and we have existing content
  if (content && currentPosition?.overview) {
    const response = await fetch('/api/generate-section', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: store.sessionId,
        sectionType: 'position',
        position: 1,
        instructions: content,
        currentContent: {
          overview: currentPosition.overview,
          bullets: currentPosition.bullets,
        },
        conversationHistory: store.messages,
      }),
    });

    const data = await response.json();

    if (data.draft) {
      const updatedOverview = data.draft.overview || currentPosition.overview;
      const updatedBullets = data.draft.bullets || currentPosition.bullets;

      store.setPosition({
        number: 1,
        title: posConfig.titleDefault,
        company: posConfig.company,
        location: posConfig.location,
        dates: posConfig.dates,
        overview: updatedOverview,
        bullets: updatedBullets,
      });

      store.addMessage({
        id: uuidv4(),
        role: 'assistant',
        content: `Updated Position 1:

**Overview:**
${updatedOverview}

${updatedBullets.length > 0 ? `**Bullets:**\n${updatedBullets.map((b: string, i: number) => `${i + 1}. ${b}`).join('\n')}` : ''}

Click **Approve** to continue, or suggest more changes.`,
      });
      return;
    }
  }

  // Initial load - fetch content
  // Get overview
  const overviewResponse = await fetch('/api/search-content', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: store.sessionId,
      contentType: 'overview',
      position: 1,
      limit: 1,
    }),
  });

  const overviewData = await overviewResponse.json();
  const overviewId = overviewData.results?.[0]?.id;

  // Tailor the overview with keywords
  let overview = overviewData.results?.[0]?.content || '';
  if (overviewId) {
    const tailorResponse = await fetch('/api/generate-section', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: store.sessionId,
        sectionType: 'overview',
        contentIds: [overviewId],
      }),
    });

    const tailorData = await tailorResponse.json();
    if (tailorData.draft) {
      overview = tailorData.draft;
    }

    // Update addressed keywords
    if (tailorData.addressedKeywordIds && tailorData.addressedKeywordIds.length > 0) {
      tailorData.addressedKeywordIds.forEach((id: string) => {
        store.updateKeywordStatus(id, 'addressed', { sectionAddressed: 'position_1' });
      });
    }
  }

  // Get bullets if long format
  let bullets: string[] = [];
  if (store.format === 'long') {
    const bulletsResponse = await fetch('/api/search-content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: store.sessionId,
        contentType: 'bullet',
        position: 1,
        limit: 4,
      }),
    });

    const bulletsData = await bulletsResponse.json();
    const bulletIds = bulletsData.results?.map((r: { id: string }) => r.id) || [];

    // Tailor bullets with keywords
    if (bulletIds.length > 0) {
      const tailorResponse = await fetch('/api/generate-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: store.sessionId,
          sectionType: 'bullet',
          contentIds: bulletIds,
        }),
      });

      const tailorData = await tailorResponse.json();
      if (tailorData.draft) {
        bullets = tailorData.draft.split('\n').filter((b: string) => b.trim()).map((b: string) => b.replace(/^[•\-]\s*/, ''));
      } else {
        bullets = bulletsData.results?.map((r: { content: string }) => r.content) || [];
      }

      // Update addressed keywords
      if (tailorData.addressedKeywordIds && tailorData.addressedKeywordIds.length > 0) {
        tailorData.addressedKeywordIds.forEach((id: string) => {
          store.updateKeywordStatus(id, 'addressed', { sectionAddressed: 'position_1' });
        });
      }
    }
  }

  store.setPosition({
    number: 1,
    title: posConfig.titleDefault,
    company: posConfig.company,
    location: posConfig.location,
    dates: posConfig.dates,
    overview,
    bullets,
  });

  store.addMessage({
    id: uuidv4(),
    role: 'assistant',
    content: `**Position 1: ${posConfig.titleDefault}**
${posConfig.company} | ${posConfig.dates}

**Overview:**
${overview}

${bullets.length > 0 ? `**Bullets:**\n${bullets.map((b, i) => `${i + 1}. ${b}`).join('\n')}` : ''}

Click **Approve** to continue, or suggest changes.`,
  });
}

async function handlePosition2(content: string, store: ReturnType<typeof useResumeStore.getState>) {
  const posConfig = POSITIONS[1];
  const currentPosition = store.positions[2];

  // If user is providing refinement feedback and we have existing content
  if (content && currentPosition?.overview) {
    const response = await fetch('/api/generate-section', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: store.sessionId,
        sectionType: 'position',
        position: 2,
        instructions: content,
        currentContent: {
          overview: currentPosition.overview,
          bullets: currentPosition.bullets,
        },
        conversationHistory: store.messages,
      }),
    });

    const data = await response.json();

    if (data.draft) {
      const updatedOverview = data.draft.overview || currentPosition.overview;
      const updatedBullets = data.draft.bullets || currentPosition.bullets;

      store.setPosition({
        number: 2,
        title: posConfig.titleDefault,
        company: posConfig.company,
        location: posConfig.location,
        dates: posConfig.dates,
        overview: updatedOverview,
        bullets: updatedBullets,
      });

      store.addMessage({
        id: uuidv4(),
        role: 'assistant',
        content: `Updated Position 2:

**Overview:**
${updatedOverview}

${updatedBullets.length > 0 ? `**Bullets:**\n${updatedBullets.map((b: string, i: number) => `${i + 1}. ${b}`).join('\n')}` : ''}

Click **Approve** to continue, or suggest more changes.`,
      });
      return;
    }
  }

  // Initial load - fetch content
  // Get overview
  const overviewResponse = await fetch('/api/search-content', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: store.sessionId,
      contentType: 'overview',
      position: 2,
      limit: 1,
    }),
  });

  const overviewData = await overviewResponse.json();
  const overviewId = overviewData.results?.[0]?.id;

  // Tailor the overview with keywords
  let overview = overviewData.results?.[0]?.content || '';
  if (overviewId) {
    const tailorResponse = await fetch('/api/generate-section', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: store.sessionId,
        sectionType: 'overview',
        contentIds: [overviewId],
      }),
    });

    const tailorData = await tailorResponse.json();
    if (tailorData.draft) {
      overview = tailorData.draft;
    }

    // Update addressed keywords
    if (tailorData.addressedKeywordIds && tailorData.addressedKeywordIds.length > 0) {
      tailorData.addressedKeywordIds.forEach((id: string) => {
        store.updateKeywordStatus(id, 'addressed', { sectionAddressed: 'position_2' });
      });
    }
  }

  // Get bullets if long format
  let bullets: string[] = [];
  if (store.format === 'long') {
    const bulletsResponse = await fetch('/api/search-content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: store.sessionId,
        contentType: 'bullet',
        position: 2,
        limit: 3,
      }),
    });

    const bulletsData = await bulletsResponse.json();
    const bulletIds = bulletsData.results?.map((r: { id: string }) => r.id) || [];

    // Tailor bullets with keywords
    if (bulletIds.length > 0) {
      const tailorResponse = await fetch('/api/generate-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: store.sessionId,
          sectionType: 'bullet',
          contentIds: bulletIds,
        }),
      });

      const tailorData = await tailorResponse.json();
      if (tailorData.draft) {
        bullets = tailorData.draft.split('\n').filter((b: string) => b.trim()).map((b: string) => b.replace(/^[•\-]\s*/, ''));
      } else {
        bullets = bulletsData.results?.map((r: { content: string }) => r.content) || [];
      }

      // Update addressed keywords
      if (tailorData.addressedKeywordIds && tailorData.addressedKeywordIds.length > 0) {
        tailorData.addressedKeywordIds.forEach((id: string) => {
          store.updateKeywordStatus(id, 'addressed', { sectionAddressed: 'position_2' });
        });
      }
    }
  }

  store.setPosition({
    number: 2,
    title: posConfig.titleDefault,
    company: posConfig.company,
    location: posConfig.location,
    dates: posConfig.dates,
    overview,
    bullets,
  });

  store.addMessage({
    id: uuidv4(),
    role: 'assistant',
    content: `**Position 2: ${posConfig.titleDefault}**
${posConfig.company} | ${posConfig.dates}

**Overview:**
${overview}

${bullets.length > 0 ? `**Bullets:**\n${bullets.map((b, i) => `${i + 1}. ${b}`).join('\n')}` : ''}

Click **Approve** to continue, or suggest changes.`,
  });
}

async function handlePositions3to6(content: string, store: ReturnType<typeof useResumeStore.getState>) {
  const positions3to6 = POSITIONS.slice(2);
  const overviews: string[] = [];

  for (const posConfig of positions3to6) {
    const response = await fetch('/api/search-content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: store.sessionId,
        contentType: 'overview',
        position: posConfig.number,
        limit: 1,
      }),
    });

    const data = await response.json();
    const overviewId = data.results?.[0]?.id;
    let overview = data.results?.[0]?.content || '';

    // Tailor the overview with keywords
    if (overviewId) {
      const tailorResponse = await fetch('/api/generate-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: store.sessionId,
          sectionType: 'overview',
          contentIds: [overviewId],
        }),
      });

      const tailorData = await tailorResponse.json();
      if (tailorData.draft) {
        overview = tailorData.draft;
      }

      // Update addressed keywords
      if (tailorData.addressedKeywordIds && tailorData.addressedKeywordIds.length > 0) {
        tailorData.addressedKeywordIds.forEach((id: string) => {
          store.updateKeywordStatus(id, 'addressed', { sectionAddressed: `position_${posConfig.number}` });
        });
      }
    }

    store.setPosition({
      number: posConfig.number,
      title: posConfig.titleDefault,
      company: posConfig.company,
      location: posConfig.location,
      dates: posConfig.dates,
      overview,
      bullets: [],
    });

    overviews.push(`**${posConfig.titleDefault}** (${posConfig.company})\n${overview}`);
  }

  store.addMessage({
    id: uuidv4(),
    role: 'assistant',
    content: `**Positions 3-6 (Overview only):**

${overviews.join('\n\n')}

Click **Approve** to finalize and proceed to export.`,
  });
}

async function triggerNextStep(step: number, store: ReturnType<typeof useResumeStore.getState>) {
  switch (step) {
    case 4:
      // Fetch highlights
      await handleHighlightsSelection('', store);
      break;
    case 5:
      await handlePosition1('', store);
      break;
    case 6:
      await handlePosition2('', store);
      break;
    case 7:
      await handlePositions3to6('', store);
      break;
    case 8:
      store.addMessage({
        id: uuidv4(),
        role: 'assistant',
        content: `🎉 Your resume is complete!

Click the **Export Resume** button below to download your tailored .docx file.`,
      });
      break;
  }
}

function getSectionType(step: number): string {
  switch (step) {
    case 0:
      return 'format';
    case 2:
      return 'header';
    case 3:
      return 'summary';
    case 4:
      return 'highlights';
    case 5:
    case 6:
    case 7:
      return 'position';
    default:
      return '';
  }
}

function getCurrentContent(store: ReturnType<typeof useResumeStore.getState>): string | object {
  switch (store.currentStep) {
    case 0:
      return store.format;
    case 2:
      return store.header || {};
    case 3:
      return store.summary;
    case 4:
      return store.highlights.join('\n');
    default:
      return '';
  }
}
