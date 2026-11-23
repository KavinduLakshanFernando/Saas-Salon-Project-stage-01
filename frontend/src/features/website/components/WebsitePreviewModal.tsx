import { useEffect, useState } from 'react';
import {
  Monitor,
  Tablet,
  Smartphone,
  ExternalLink,
  RotateCw,
  X,
  Eye,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WebsitePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  previewUrl: string;
  templateName: string;
}

export function WebsitePreviewModal({
  isOpen,
  onClose,
  previewUrl,
  templateName,
}: WebsitePreviewModalProps) {
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [key, setKey] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [hasTimeout, setHasTimeout] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    setHasTimeout(false);

    // If iframe does not load within 6s, show helpful troubleshooting helper
    const timer = setTimeout(() => {
      setHasTimeout(true);
    }, 6000);

    return () => clearTimeout(timer);
  }, [isOpen, key, previewUrl]);

  if (!isOpen) return null;

  const reloadIframe = () => {
    setIsLoading(true);
    setHasTimeout(false);
    setKey((k) => k + 1);
  };

  const getContainerWidth = () => {
    switch (device) {
      case 'mobile':
        return 'w-[375px] h-[667px]';
      case 'tablet':
        return 'w-[768px] h-[800px]';
      case 'desktop':
      default:
        return 'w-full h-full';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="flex flex-col w-full h-[95vh] max-w-7xl bg-slate-900 rounded-3xl shadow-2xl border border-slate-800 overflow-hidden">
        {/* Modal Top Control Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-400">
              <Eye className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Live Draft Preview</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {templateName}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Previewing current draft content before making it live
              </p>
            </div>
          </div>

          {/* Device Viewport Selector */}
          <div className="hidden sm:flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setDevice('desktop')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                device === 'desktop'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Desktop</span>
            </button>
            <button
              onClick={() => setDevice('tablet')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                device === 'tablet'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Tablet className="w-3.5 h-3.5" />
              <span>Tablet</span>
            </button>
            <button
              onClick={() => setDevice('mobile')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                device === 'mobile'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Mobile</span>
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={reloadIframe}
              className="text-slate-300 border-slate-700 hover:bg-slate-800 h-9 px-3 gap-1.5 text-xs"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-lg border border-slate-700 transition-colors h-9"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Open New Tab</span>
            </a>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-slate-400 hover:text-white hover:bg-slate-800 h-9 w-9 p-0 rounded-xl"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Iframe Viewport Container */}
        <div className="flex-1 bg-slate-950/70 p-4 sm:p-6 overflow-auto flex items-center justify-center relative">
          <div
            className={`transition-all duration-300 rounded-2xl overflow-hidden shadow-2xl border-4 border-slate-800 bg-white relative ${getContainerWidth()}`}
          >
            {/* Loading Indicator */}
            {isLoading && (
              <div className="absolute inset-0 bg-white/95 z-20 flex flex-col items-center justify-center p-6 text-center space-y-3">
                <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
                <div>
                  <h4 className="text-sm font-bold text-slate-800">Rendering {templateName}...</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Loading preview with your latest draft changes</p>
                </div>
              </div>
            )}

            {/* Offline Helper Notice if loading takes > 6s */}
            {hasTimeout && isLoading && (
              <div className="absolute inset-0 bg-white z-30 flex flex-col items-center justify-center p-6 text-center space-y-4 max-w-md mx-auto">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900">Website Service Starting or Offline</h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    The Next.js website server (port 3002) is taking longer than expected to respond.
                  </p>
                </div>
                <div className="w-full bg-slate-50 p-3 rounded-xl border border-slate-200 text-left text-xs font-mono text-slate-700">
                  <p className="font-sans text-[11px] font-semibold text-slate-500 mb-1">To start the website service manually:</p>
                  <code>npm run dev:salon-websites</code>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Button size="sm" onClick={reloadIframe} className="text-xs gap-1.5 bg-primary font-bold">
                    <RotateCw className="w-3.5 h-3.5" />
                    Retry Connection
                  </Button>
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <span>Open in Tab</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}

            <iframe
              key={key}
              src={previewUrl}
              title="Salon Website Preview"
              className="w-full h-full border-0"
              onLoad={() => {
                setIsLoading(false);
                setHasTimeout(false);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
