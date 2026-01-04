'use client';

import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface NewSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSessionCreated: (sessionId: string) => void;
}

export function NewSessionModal({ isOpen, onClose, onSessionCreated }: NewSessionModalProps) {
  const [name, setName] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [format, setFormat] = useState<'long' | 'short'>('long');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Session name is required');
      return;
    }

    if (!jobDescription.trim()) {
      setError('Job description is required');
      return;
    }

    setIsLoading(true);

    try {
      // Step 1: Create session and analyze JD
      const analyzeResponse = await fetch('/api/analyze-jd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription, name: name.trim() }),
      });

      const analyzeData = await analyzeResponse.json();

      if (!analyzeData.sessionId) {
        throw new Error(analyzeData.error || 'Failed to analyze job description');
      }

      // Step 2: Generate full resume
      const generateResponse = await fetch('/api/generate-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: analyzeData.sessionId }),
      });

      const generateData = await generateResponse.json();

      if (!generateData.success) {
        throw new Error(generateData.error || 'Failed to generate resume');
      }

      // Success - notify parent
      onSessionCreated(analyzeData.sessionId);

      // Reset form
      setName('');
      setJobDescription('');
      setFormat('long');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setName('');
      setJobDescription('');
      setFormat('long');
      setError('');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Resume Session</DialogTitle>
          <DialogDescription>
            Create a new tailored resume by pasting a job description
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Session Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Session Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Mastercard, Anthropic GTM"
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500">
              Give this session a memorable name to find it later
            </p>
          </div>

          {/* Format Selection */}
          <div className="space-y-2">
            <Label>Resume Format</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  value="long"
                  checked={format === 'long'}
                  onChange={() => setFormat('long')}
                  className="w-4 h-4 text-blue-600"
                  disabled={isLoading}
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
                  disabled={isLoading}
                />
                <span className={format === 'short' ? 'font-medium' : 'text-gray-600'}>
                  Short Format
                </span>
                <span className="text-xs text-gray-400">(overviews only)</span>
              </label>
            </div>
          </div>

          {/* Job Description */}
          <div className="space-y-2">
            <Label htmlFor="jd">Job Description</Label>
            <textarea
              id="jd"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the full job description here..."
              className="w-full h-48 p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              disabled={isLoading}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="gap-2">
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Create & Generate
                </>
              )}
            </Button>
          </div>

          {isLoading && (
            <p className="text-center text-sm text-gray-500">
              Analyzing job description and tailoring your resume. This takes 15-30 seconds.
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
