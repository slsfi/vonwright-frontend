export interface ReadingTextApiResponse {
  content: string;
  id: string;
  language: string;
}

export interface ReadingText {
  html: string;
  id: string;
  language: string;
}

export const toReadingText = (rt: ReadingTextApiResponse): ReadingText => ({
  html: rt.content,
  id: rt.id,
  language: rt.language ?? undefined,
});
