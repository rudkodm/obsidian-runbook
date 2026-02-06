// Mock for obsidian module in tests
export const setIcon = (el: HTMLElement, iconId: string): void => {
	el.setAttribute("data-icon", iconId);
};
