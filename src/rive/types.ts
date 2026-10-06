import type { DrawOptimizationOptions } from '@rive-app/webgl2';

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

/** Where Rive draws the artboard on the drawing surface, in its pixels. Immutable: set a copy. */
export interface RiveLayout {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  copyWith(bounds: { minX: number; minY: number; maxX: number; maxY: number }): RiveLayout;
}

export interface RiveInstance {
  readonly stateMachineNames: string[];
  readonly viewModelInstance: ViewModel | null;
  /** setting it draws a frame at once where nothing plays; a resize resets it to the whole surface */
  layout: RiveLayout;
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
  /** each frame draws, also one where only the layout moved */
  drawingOptions?: DrawOptimizationOptions.AlwaysDraw;
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
  /** The drawing surface was resized, to `width` × `height` pixels, and its layout reset to all of it. */
  resized?(width: number, height: number): void;
  cleanup?(): void;
};
