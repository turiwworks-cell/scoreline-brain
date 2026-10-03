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
  play(name?: string): void;
  pause(): void;
  stopRendering(): void;
  startRendering(): void;
  resizeDrawingSurfaceToCanvas(): void;
  cleanup(): void;
}

export interface RiveOptions {
  canvas: HTMLCanvasElement;
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
