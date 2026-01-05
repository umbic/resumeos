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
