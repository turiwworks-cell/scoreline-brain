import { useEffect, useLayoutEffect, useRef, type CSSProperties } from 'react';
import { mountCanvas } from './canvasLifecycle';
import type { CanvasBinding, RiveInstance } from './types';

export type RiveCanvasProps = {
  source: string;
  artboard?: string;
  /** start without waiting for an idle slot (canvasLifecycle) */
  eager?: boolean;
  onAdvance?(): void;
  className?: string;
  style?: CSSProperties;
  bind(instance: RiveInstance, requestSync: () => void): CanvasBinding | void;
  onReady?(): void;
  onError?(error: unknown): void;
};

export function RiveCanvas(props: RiveCanvasProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const latest = useRef(props);
  useLayoutEffect(() => { latest.current = props; });
  useEffect(() => {
    if (!canvas.current) return;
    const life = mountCanvas(canvas.current, {
      source: props.source,
      artboard: props.artboard,
      eager: props.eager,
      advance: () => latest.current.onAdvance?.(),
      bind: (instance, requestSync) => latest.current.bind(instance, requestSync),
      ready: () => latest.current.onReady?.(),
      error: (error) => latest.current.onError?.(error),
    });
    return () => life.dispose();
  }, [props.source, props.artboard, props.eager]);
  return <canvas ref={canvas} className={props.className} aria-hidden="true" tabIndex={-1} style={{ ...props.style, pointerEvents: 'none' }} />;
}
