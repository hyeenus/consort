import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

export type HelpTopic =
  | 'welcome'
  | 'canvas-basics'
  | 'add-step'
  | 'auto-calc'
  | 'arrows'
  | 'count-format'
  | 'free-edit'
  | 'export-svg'
  | 'export-png'
  | 'export-json'
  | 'import-json'
  | 'inspector-node'
  | 'inspector-interval'
  | 'exclusion-reasons';

interface HelpMessage {
  topic: HelpTopic;
  title: string;
  body: React.ReactNode;
}

interface HelpContextValue {
  requestHelp: (topic: HelpTopic, message: Omit<HelpMessage, 'topic'>) => void;
  helpEnabled: boolean;
  hasSeenTopic: (topic: HelpTopic) => boolean;
}

const HelpContext = createContext<HelpContextValue | undefined>(undefined);

interface HelpProviderProps {
  helpEnabled: boolean;
  onDisableHelp: () => void;
  children: React.ReactNode;
  welcomeMessage: Omit<HelpMessage, 'topic'>;
}

export const HelpProvider: React.FC<HelpProviderProps> = ({
  helpEnabled,
  onDisableHelp,
  children,
  welcomeMessage,
}) => {
  const [queue, setQueue] = useState<HelpMessage[]>(() =>
    helpEnabled ? [{ ...welcomeMessage, topic: 'welcome' }] : []
  );
  const seenTopicsRef = useRef<Set<HelpTopic>>(new Set(helpEnabled ? ['welcome'] : []));
  const pendingRef = useRef<HelpMessage[]>([]);
  const prevHelpEnabled = useRef(helpEnabled);
  const welcomeQueuedRef = useRef(helpEnabled);

  const hasSeenTopic = useCallback((topic: HelpTopic) => seenTopicsRef.current.has(topic), []);

  const requestHelp = useCallback(
    (topic: HelpTopic, message: Omit<HelpMessage, 'topic'>) => {
      if (!helpEnabled) {
        return;
      }
      if (seenTopicsRef.current.has(topic)) {
        return;
      }
      const composed: HelpMessage = { ...message, topic };
      if (topic !== 'welcome' && !welcomeQueuedRef.current) {
        pendingRef.current = [...pendingRef.current, composed];
        seenTopicsRef.current.add(topic);
        return;
      }
      seenTopicsRef.current.add(topic);
      setQueue((current) => [...current, composed]);
    },
    [helpEnabled]
  );

  const dismissCurrent = useCallback(() => {
    setQueue((current) => current.slice(1));
  }, []);

  useEffect(() => {
    if (!helpEnabled) {
      setQueue([]);
      pendingRef.current = [];
      welcomeQueuedRef.current = false;
      prevHelpEnabled.current = helpEnabled;
      return;
    }
    if (!prevHelpEnabled.current && helpEnabled) {
      seenTopicsRef.current = new Set(['welcome']);
      pendingRef.current = [];
      welcomeQueuedRef.current = true;
      setQueue([{ ...welcomeMessage, topic: 'welcome' }]);
    }
    prevHelpEnabled.current = helpEnabled;
  }, [helpEnabled, welcomeMessage]);

  useEffect(() => {
    if (
      helpEnabled &&
      seenTopicsRef.current.has('welcome') &&
      queue.length === 0 &&
      pendingRef.current.length > 0
    ) {
      setQueue(pendingRef.current);
      pendingRef.current = [];
    }
  }, [helpEnabled, queue.length]);

  const contextValue = useMemo<HelpContextValue>(() => ({
    requestHelp,
    helpEnabled,
    hasSeenTopic,
  }), [hasSeenTopic, helpEnabled, requestHelp]);

  const currentMessage = queue[0];

  return (
    <HelpContext.Provider value={contextValue}>
      {children}
      {helpEnabled && currentMessage ? (
        <div className="help-overlay" role="dialog" aria-live="polite">
          <div className="help-dialog">
            <div>
              <p className="help-tag">Quick tip</p>
              <h2>{currentMessage.title}</h2>
              <div className="help-body">{currentMessage.body}</div>
            </div>
            <div className="help-actions">
              <button type="button" onClick={dismissCurrent}>
                Got it
              </button>
              <button type="button" className="help-disable" onClick={onDisableHelp}>
                Turn off help
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </HelpContext.Provider>
  );
};

export function useHelp() {
  const ctx = useContext(HelpContext);
  if (!ctx) {
    throw new Error('useHelp must be used within a HelpProvider');
  }
  return ctx;
}
