/**
 * Lets the player controller drive the router without importing it.
 *
 * The player provider lives above `RouterProvider`, so it cannot use
 * `useNavigate()`. Importing the router module directly would create a cycle
 * (router → pages → controller → router), so the router registers its navigate
 * function here instead. This module imports nothing on purpose.
 */

type NavigateFn = (to: string) => void;

let navigate: NavigateFn | null = null;

export function setNavigator(fn: NavigateFn): void {
  navigate = fn;
}

export function navigateTo(to: string): void {
  navigate?.(to);
}

export function hasNavigator(): boolean {
  return navigate !== null;
}
