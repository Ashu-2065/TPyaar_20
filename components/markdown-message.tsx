'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = {
  content: string;
  className?: string;
};

export default function MarkdownMessage({ content, className }: Props) {
  return (
    <div className={cn('prose prose-sm dark:prose-invert max-w-none', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre({ children, ...props }) {
            return (
              <div className="relative my-3 rounded-md overflow-hidden ring-1 ring-border">
                <CopyCodeButton text={extractCodeText(children)} />
                <pre
                  {...props}
                  className="bg-zinc-900 text-zinc-100 p-3 overflow-x-auto text-[13px]"
                >
                  {children}
                </pre>
              </div>
            );
          },
          code({ inline, className, children, ...props }) {
            const isBlock = !inline;
            const langMatch = /language-(\w+)/.exec(className || '');
            if (isBlock) {
              return (
                <code {...props} className={className}>
                  {children}
                </code>
              );
            }
            return (
              <code
                {...props}
                className="px-1.5 py-0.5 rounded bg-zinc-800/90 text-zinc-100"
              >
                {children}
              </code>
            );
          },
          a({ children, ...props }) {
            return (
              <a {...props} className="text-emerald-500 underline hover:text-emerald-400">
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
}

function extractCodeText(children: React.ReactNode): string {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) {
    return children.map((c: any) => (typeof c === 'string' ? c : String((c?.props as any)?.children || ''))).join('');
  }
  // @ts-expect-error
  return String(children?.props?.children || '');
}

function CopyCodeButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="icon"
      variant="secondary"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="absolute top-2 right-2 h-8 w-8 bg-zinc-700 text-white hover:bg-zinc-600"
      aria-label={copied ? 'Copied' : 'Copy code'}
    >
      <Copy className="h-4 w-4" />
    </Button>
  );
}
