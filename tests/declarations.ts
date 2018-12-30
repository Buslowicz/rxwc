(global as any).HTMLElement = class HTMLElement {};
(global as any).CustomEvent = class CustomEvent {constructor(public type: string) {}};
