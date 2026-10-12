import ja from './ja.json';
import en from './en.json';

export type ViewerMessages = Record<string, Record<string, string>>;

export const messages: Record<'ja' | 'en', ViewerMessages> = { ja, en };
