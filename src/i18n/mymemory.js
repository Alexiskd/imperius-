// Client du moteur de traduction MyMemory (https://mymemory.translated.net, gratuit, sans clé).
// Limite de l'API : environ 500 octets par requête ; au-delà, le texte est coupé aux phrases.
import { SOURCE_LANG } from './langues.js';

export const ENDPOINT = 'https://api.mymemory.translated.net/get';
const MAX_CHARS = 380; // marge pour les caractères sur plusieurs octets

// splitForApi : découpe un long texte en morceaux de MAX_CHARS au plus, de préférence après un point.
export function splitForApi(text, max = MAX_CHARS) {
  if (text.length <= max) return [text];
  const parts = [];
  let cur = '';
  for (const piece of text.split(/(?<=[.!?…。])\s+/)) {
    if (cur && cur.length + piece.length + 1 > max) { parts.push(cur); cur = ''; }
    if (piece.length > max) { // phrase trop longue : coupe aux espaces
      for (const w of piece.split(' ')) {
        if (cur && cur.length + w.length + 1 > max) { parts.push(cur); cur = ''; }
        cur = cur ? `${cur} ${w}` : w;
      }
    } else cur = cur ? `${cur} ${piece}` : piece;
  }
  if (cur) parts.push(cur);
  return parts;
}

export class TranslateError extends Error {
  constructor(message, code) { super(message); this.code = code; } // code : 'quota' | 'langue' | 'reseau'
}

// translateChunk : une requête. Le quota gratuit épuisé répond 429 (ou un texte « MYMEMORY WARNING »).
async function translateChunk(text, target, { fetchImpl, email, timeoutMs }) {
  const url = `${ENDPOINT}?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(`${SOURCE_LANG}|${target}`)}${email ? `&de=${encodeURIComponent(email)}` : ''}`;
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
  let res;
  try { res = await fetchImpl(url, ctl ? { signal: ctl.signal } : undefined); }
  catch (e) { throw new TranslateError('Réseau indisponible', 'reseau'); }
  finally { if (timer) clearTimeout(timer); }
  if (res.status === 429) throw new TranslateError('Quota de traduction atteint', 'quota');
  let data;
  try { data = await res.json(); } catch (e) { throw new TranslateError('Réponse illisible', 'reseau'); }
  const status = Number(data && data.responseStatus);
  const out = data && data.responseData && data.responseData.translatedText;
  if (status === 429 || /MYMEMORY WARNING/i.test(String(out))) throw new TranslateError('Quota de traduction atteint', 'quota');
  if (status === 403 || /INVALID LANGUAGE|SELECT TWO DISTINCT/i.test(String(out))) throw new TranslateError('Langue non prise en charge', 'langue');
  if (status !== 200 || typeof out !== 'string' || !out) throw new TranslateError('Traduction indisponible', 'reseau');
  return out;
}

// translate : traduit un texte français vers `target`. Options : fetchImpl (tests), email (quota plus large), timeoutMs.
export async function translate(text, target, { fetchImpl = (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null), email = '', timeoutMs = 12000 } = {}) {
  if (!fetchImpl) throw new TranslateError('Réseau indisponible', 'reseau');
  const out = [];
  for (const chunk of splitForApi(text)) out.push(await translateChunk(chunk, target, { fetchImpl, email, timeoutMs }));
  return out.join(' ');
}
