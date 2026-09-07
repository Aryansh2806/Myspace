export type WaMessage = { sender: string; text: string };
/** null when the text is not a WhatsApp export. */
export function parseWhatsApp(raw: string): WaMessage[] | null;
export function chunk(msgs: WaMessage[], size?: number): WaMessage[][];
