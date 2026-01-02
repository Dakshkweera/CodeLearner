import { useState } from 'react';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Components } from 'react-markdown';

type AiMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5002';


interface FileAiOverlayProps {
  file: {
    path: string;
    content: string;
    language: 'javascript' | 'typescript';
  };
  owner: string;
  repoName: string;
  onClose: () => void;
}

const FileAiOverlay: React.FC<FileAiOverlayProps> = ({
  file,
  owner,
  repoName,
  onClose,
}) => {
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<AiMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const [fontSize, setFontSize] = useState(14);

  const increaseFont = () => setFontSize(f => Math.min(f + 1, 24));
  const decreaseFont = () => setFontSize(f => Math.max(f - 1, 10));

  const handleAsk = async () => {
    const trimmed = question.trim();
    if (!trimmed) return;

    const newHistory: AiMessage[] = [...history, { role: 'user', content: trimmed }];
    setHistory(newHistory);
    setQuestion('');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/ai/file-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          owner,
          name: repoName,
          path: file.path,
          question: trimmed,
          history: newHistory.slice(0, -1),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to get AI response');
      }

      const data = await response.json();

      setHistory([
        ...newHistory,
        { role: 'assistant', content: data.answer },
      ]);
    } catch (err: any) {
      console.error('AI request failed:', err);
      setHistory([
        ...newHistory,
        {
          role: 'assistant',
          content:
            `❌ Error: ${err.message || 'Failed to get AI response. Please try again.'}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!loading) {
        handleAsk();
      }
    }
  };

  const markdownComponents: Components = {
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';

      if (!className) {
        return (
          <code
            className="bg-gray-700 px-1.5 py-0.5 rounded text-xs"
            {...props}
          >
            {children}
          </code>
        );
      }

      return (
        <SyntaxHighlighter
          style={vscDarkPlus as any}
          language={language}
          PreTag="div"
          customStyle={{
            borderRadius: '0.375rem',
            fontSize: '0.75rem',
            margin: '0.5rem 0',
          }}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      );
    },
    ul({ children }) {
      return (
        <ul className="space-y-1 my-2 list-disc list-inside text-gray-200">
          {children}
        </ul>
      );
    },
    li({ children }) {
      return <li className="leading-relaxed text-xs">{children}</li>;
    },
    strong({ children }) {
      return (
        <strong className="font-semibold text-blue-400">
          {children}
        </strong>
      );
    },
    p({ children }) {
      return <p className="my-1 text-xs leading-relaxed">{children}</p>;
    },
    a({ href, children }) {
      return (
        <a
          href={href}
          className="text-blue-400 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {children}
        </a>
      );
    },
  };

  return (
    <div className="fixed inset-0 z-40 bg-black bg-opacity-80 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-700 bg-gray-900">
        <div className="flex flex-col">
          <span className="text-xs text-gray-400">AI Assistant · Current file</span>
          <span className="text-sm font-semibold text-white truncate max-w-xl">
            {file.path}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 text-xs text-gray-300">
            <span>Font</span>
            <button
              onClick={decreaseFont}
              className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm hover:bg-gray-700"
            >
              A-
            </button>
            <button
              onClick={increaseFont}
              className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm hover:bg-gray-700"
            >
              A+
            </button>
          </div>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: code */}
        <div className="w-1/2 border-r border-gray-700 bg-gray-900">
          <Editor
            height="100%"
            language={file.language}
            value={file.content}
            theme="vs-dark"
            options={{
              readOnly: true,
              minimap: { enabled: true },
              fontSize,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              wordWrap: 'on',
            }}
          />
        </div>

        {/* Right: chat */}
        <div className="w-1/2 flex flex-col bg-gray-950">
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            <div className="text-xs text-gray-400 mb-2">
              Ask questions about this file. Context is limited to the code shown on
              the left.
            </div>

            {history.map((msg, idx) => (
              <div
                key={idx}
                className={
                  msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'
                }
              >
                <div
                  className={
                    msg.role === 'user'
                      ? 'max-w-[80%] rounded-lg px-3 py-2 bg-blue-600 text-white text-sm'
                      : 'max-w-[80%] rounded-lg px-3 py-2 bg-gray-800 text-gray-100 text-sm'
                  }
                >
                  {msg.role === 'user' ? (
                    msg.content
                  ) : (
                    <div className="prose prose-sm prose-invert max-w-none">
                      <ReactMarkdown components={markdownComponents}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-lg px-3 py-2 bg-gray-800 text-gray-400 text-xs">
                  <span className="inline-flex items-center gap-1">
                    <span className="animate-pulse">●</span>
                    <span className="animate-pulse animation-delay-200">●</span>
                    <span className="animate-pulse animation-delay-400">●</span>
                    <span className="ml-1">Thinking</span>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-gray-800 px-4 py-3 bg-gray-900">
            <div className="flex items-end gap-3">
              <textarea
                rows={2}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Ask AI about this file… (Press Enter to send, Shift+Enter for new line)"
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
              />
              <button
                onClick={handleAsk}
                disabled={loading || !question.trim()}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-md h-10 self-stretch transition-colors"
              >
                {loading ? 'Asking…' : 'Ask'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileAiOverlay;
