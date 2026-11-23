import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

export interface ModuleNavTab {
  label: string;
  to?: string;
  onClick?: () => void;
  active?: boolean;
}

interface ModuleSubNavProps {
  backTo?: string;
  backLabel?: string;
  tabs?: ModuleNavTab[];
  action?: ReactNode;
  className?: string;
}

export function ModuleSubNav({
  backTo,
  backLabel,
  tabs = [],
  action,
  className = '',
}: ModuleSubNavProps) {
  const location = useLocation();

  return (
    <div className={`space-y-2.5 mb-4 ${className}`}>
      {/* Back button and optional action row */}
      {(backTo || action) && (
        <div className="flex items-center justify-between gap-3">
          {backTo ? (
            <Link
              to={backTo}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors py-1 px-2 rounded-lg hover:bg-slate-100"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>{backLabel || 'Back'}</span>
            </Link>
          ) : (
            <div />
          )}

          {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
      )}

      {/* Compact Segmented Switcher for tabs */}
      {tabs.length > 0 && (
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-fit max-w-full overflow-x-auto scrollbar-none">
          {tabs.map((tab) => {
            const isActive =
              tab.active !== undefined
                ? tab.active
                : tab.to
                  ? location.pathname === tab.to ||
                    (tab.to.includes('?') &&
                      location.pathname + location.search === tab.to)
                  : false;

            const baseClass = `px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              isActive
                ? 'bg-white text-blue-600 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`;

            if (tab.onClick) {
              return (
                <button
                  key={tab.label}
                  type="button"
                  onClick={tab.onClick}
                  className={baseClass}
                >
                  {tab.label}
                </button>
              );
            }

            return (
              <Link
                key={(tab.to || '') + tab.label}
                to={tab.to || '#'}
                className={baseClass}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
