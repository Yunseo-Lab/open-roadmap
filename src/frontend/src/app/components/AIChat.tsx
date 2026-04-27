import { useState } from 'react';
import { Plus, Paperclip, ArrowUp } from 'lucide-react';

interface AIChatProps {
  isOpen: boolean;
}

export function AIChat({ isOpen }: AIChatProps) {
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;
    console.log('Sending:', input);
    setInput('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-3xl px-4 z-50">
      <div className="bg-background/95 backdrop-blur-sm border border-border rounded-full shadow-2xl px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            className="p-2 hover:bg-accent rounded-full transition-colors flex-shrink-0"
            title="Add new node"
          >
            <Plus className="w-5 h-5" />
          </button>
          <button
            className="p-2 hover:bg-accent rounded-full transition-colors flex-shrink-0"
            title="Attach file"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <div className="flex-1 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Describe your goal or generate a roadmap..."
              className="w-full px-4 py-2 bg-transparent border-none text-sm focus:outline-none"
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="p-2 bg-foreground text-background rounded-full hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
            title="Send"
          >
            <ArrowUp className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
