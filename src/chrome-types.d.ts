// chrome-types.d.ts
declare namespace chrome {
  export namespace sidePanel {
    export function open(options?: { windowId?: number, tabId?: number }): Promise<void>;
    export function setPanelBehavior(options: { openPanelOnActionClick: boolean }): Promise<void>;
  }
}
