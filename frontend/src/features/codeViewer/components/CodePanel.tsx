import { useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { useAppStore } from '../../../shared/store/appStore';

const CodePanel = () => {
  const { selectedFile, setSelectedFile } = useAppStore();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setSelectedFile(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setSelectedFile]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedFile(null);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [setSelectedFile]);

  if (!selectedFile) return null;

  return (
    <>
      {/* Dark Overlay Background */}
      <div className="absolute inset-0 bg-black bg-opacity-60 z-10" />

      {/* Code Panel */}
      <div
        ref={panelRef}
        className="absolute top-8 right-8 bottom-8 w-3/5 bg-gray-900 border-2 border-gray-700 rounded-lg shadow-2xl z-20 flex flex-col"
      >
        {/* Header */}
        <div className="bg-gray-800 px-6 py-4 border-b border-gray-700 flex items-center justify-between">
          <div className="flex-1">
            <h3 className="text-white font-semibold text-lg truncate">
              {selectedFile.path}
            </h3>
            <p className="text-gray-400 text-sm mt-1">
              {selectedFile.language === 'typescript' ? 'TypeScript' : 'JavaScript'}
            </p>
          </div>

          {/* Close Button */}
          <button
            onClick={() => setSelectedFile(null)}
            className="ml-4 text-gray-400 hover:text-white transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Code Editor */}
        <div className="flex-1 overflow-hidden">
          <Editor
            height="100%"
            language={selectedFile.language}
            value={selectedFile.content}
            theme="vs-dark"
            options={{
              readOnly: true,
              minimap: { enabled: true },
              fontSize: 14,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              wordWrap: 'on',
            }}
          />
        </div>

        {/* Footer */}
        <div className="bg-gray-800 px-6 py-3 border-t border-gray-700 flex items-center justify-between">
          <p className="text-gray-500 text-sm">
            Click outside or press <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">ESC</kbd> to close
          </p>
          <button
            onClick={() => {
              navigator.clipboard.writeText(selectedFile.content);
            }}
            className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
          >
            Copy Code
          </button>
        </div>
      </div>
    </>
  );
};

export default CodePanel;
