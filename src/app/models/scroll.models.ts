export type ScrollYPos = 'top' | 'center';

export type ScrollBehavior = 'smooth' | 'instant' | 'auto';

export type ScrollPlan = {
  behavior: ScrollBehavior;
  container: HTMLElement;
  top: number;
};
