import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

const FormattedMessage = ({ content, isUser }) => {
  if (isUser) {
    return <div className="text-gray-800 dark:text-gray-200">{content}</div>;
  }

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown
        components={{
          // Custom code block rendering
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            return !inline && match ? (
              <SyntaxHighlighter
                style={vscDarkPlus}
                language={match[1]}
                PreTag="div"
                className="rounded-md text-sm"
                {...props}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            ) : (
              <code
                className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm"
                {...props}
              >
                {children}
              </code>
            );
          },
          // Style bullet points
          ul({ children }) {
            return (
              <ul className="space-y-2 my-3 list-disc list-inside text-gray-700 dark:text-gray-300">
                {children}
              </ul>
            );
          },
          // Style list items
          li({ children }) {
            return <li className="leading-relaxed">{children}</li>;
          },
          // Style bold text (for line references like [Line 37])
          strong({ children }) {
            return (
              <strong className="font-semibold text-blue-600 dark:text-blue-400">
                {children}
              </strong>
            );
          },
          // Style links
          a({ href, children }) {
            return (
              <a
                href={href}
                className="text-blue-600 dark:text-blue-400 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default FormattedMessage;
