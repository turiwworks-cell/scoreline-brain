/** The small public webgl2 surface used by the app; no runtime import in the shell. */
export interface Property<T> {
  value: T;
  on(callback: () => void): void;
  off(callback: () => void): void;
}

export interface ViewModel {
  boolean(name: string): Property<boolean> | null;
  string(name: string): Property<string> | null;
  number(name: string): Property<number> | null;
  color(name: string): Property<number> | null;
  trigger(name: string): { trigger(): void } | null;
}

export interface RiveInstance {
  readonly stateMachineNames: string[];
  readonly viewModelInstance: ViewModel | null;
  reset(options: { artboard?: string; stateMachine: string; autoplay: false; autoBind: true }): void;
  play(name?: string): void;
  pause(): void;
  stopRendering(): void;
  startRendering(): void;
  /** sizes the drawing surface to the canvas's client rect times the ratio (window.devicePixelRatio by default) */
  resizeDrawingSurfaceToCanvas(customDevicePixelRatio?: number): void;
  cleanup(): void;
}

export interface RiveOptions {
  canvas: HTMLCanvasElement;
  artboard?: string;
  tabIndex: -1;
  focusOptions: { allowFocusInterrupt: false };
  shouldDisableRiveListeners: true;
  onAdvance?(): void;
  buffer: ArrayBuffer;
  autoplay: false;
  autoBind: true;
  useOffscreenRenderer: true;
  enableRiveAssetCDN: false;
  onLoad(): void;
  onLoadError(error: unknown): void;
}

export interface RiveRuntime {
  Rive: new (options: RiveOptions) => RiveInstance;
}

export type CanvasBinding = {
  shouldPlay?(): boolean;
  /** Called before playing, including every resume. Must not draw. */
  resume?(): void;
  cleanup?(): void;
};
