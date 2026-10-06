export type FaerieTone = 'moonlight' | 'lilac' | 'rose' | 'leaf';
export type FaerieMotion = 'auto' | 'reduced';
export type FaerieState = 'idle' | 'attending' | 'speaking' | 'following' | 'celebrating' | 'hidden';
export type FaeriePlacement = 'auto' | 'left' | 'right' | 'top' | 'bottom';
export type FaeriePoint = { x: number; y: number };
export type FaerieTarget = Element | string | FaeriePoint | null | (() => Element | FaeriePoint | null);
export interface FaerieAction { label: string; onSelect: () => void; }
export interface FaerieHintOptions { duration?: number; action?: FaerieAction; }
export interface FaerieAttendOptions extends FaerieHintOptions {
  message?: string;
  placement?: FaeriePlacement;
  /** Explicitly allow bringing an offscreen target into view. Defaults to false. */
  scroll?: boolean;
}
export interface FaerieAppearance { tone?: FaerieTone; motion?: FaerieMotion; size?: number; }
export interface FaerieOptions extends FaerieAppearance { container?: HTMLElement; zIndex?: number; }
export interface Faerie {
  readonly element: HTMLDivElement;
  readonly state: FaerieState;
  attend(target: FaerieTarget, options?: FaerieAttendOptions): boolean;
  say(message: string, options?: FaerieHintOptions): void;
  celebrate(message?: string): void;
  follow(enabled?: boolean): void;
  rest(): void;
  hide(): void;
  show(): void;
  configure(options: FaerieAppearance): void;
  destroy(): void;
}
/** Safe to import during SSR; call this factory in a browser after mounting. */
export function createFaerie(options?: FaerieOptions): Faerie;
