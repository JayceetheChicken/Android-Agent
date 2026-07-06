import { ALLOWED_URL_PROTOCOLS, BROWSER_HOME_URL } from '../../config/constants';
import { generateId } from '../../utils/json';

/**
 * Bridge between the agent's browser tools and the WebView on the Browser screen.
 *
 * Two channels:
 * 1. Command bus (open_url / go_back): fire-and-forget, applied by the screen.
 * 2. Script bridge: promise-based DOM commands with request IDs. The service
 *    builds a sandboxed page script, the screen injects it via
 *    injectJavaScript, the page answers through
 *    window.ReactNativeWebView.postMessage and handleBridgeMessage() resolves
 *    the matching promise. Timeouts reject cleanly (e.g. after navigation).
 *
 * The WebView stays the ONLY place where DOM actions run; agent tools only
 * ever call the exported functions here and never touch the WebView itself.
 * Scripts are built exclusively from the fixed templates below – arguments
 * are embedded via JSON.stringify, so no free-form/user code is ever injected.
 */

export type BrowserCommand =
  | { type: 'open_url'; url: string }
  | { type: 'go_back' }
  | { type: 'stop_loading' };

export interface BrowserState {
  currentUrl: string;
  currentTitle: string;
  canGoBack: boolean;
  loading: boolean;
  lastLoadStartedAt?: number;
  lastLoadFinishedAt?: number;
  lastError?: string;
  lastHttpError?: string;
  /** Last navigation that was blocked by the protocol allowlist (if any). */
  lastBlockedUrl?: string;
  lastBlockedReason?: string;
}

export interface PageSnapshot {
  currentUrl: string;
  currentTitle: string;
  canGoBack: boolean;
  text: string;
  headings: Array<{ level: number; text: string }>;
  links: Array<{ text: string; href: string }>;
  buttons: Array<{ text: string }>;
  inputs: Array<{
    tag: string;
    type?: string;
    name?: string;
    id?: string;
    placeholder?: string;
    ariaLabel?: string;
  }>;
}

type Listener = (command: BrowserCommand) => void;
type ScriptRunner = (script: string) => void;

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const DEFAULT_TIMEOUT_MS = 6000;
const READ_PAGE_TIMEOUT_MS = 15000;
const READY_TIMEOUT_MS = 4000;

const state: BrowserState = {
  currentUrl: BROWSER_HOME_URL,
  currentTitle: '',
  canGoBack: false,
  loading: false,
};

const listeners = new Set<Listener>();
const pending = new Map<string, PendingRequest>();
let scriptRunner: ScriptRunner | null = null;

// ------------------------------------------------------------- readiness

/**
 * The browser is "ready" once the Browser screen is mounted: it has both
 * subscribed to the command bus and registered a script runner. With the
 * Browser tab mounted eagerly (lazy: false) this is true from app launch.
 */
export function isBrowserReady(): boolean {
  return scriptRunner !== null && listeners.size > 0;
}

/**
 * Ensures the in-app browser is mounted before a browser tool runs. The
 * Browser tab is mounted eagerly by React Navigation, so this usually returns
 * immediately; the short wait covers app startup and WebView initialization.
 */
export async function ensureBrowserReady(timeoutMs = READY_TIMEOUT_MS): Promise<void> {
  if (isBrowserReady()) {
    return;
  }
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (isBrowserReady()) {
      return;
    }
  }
  throw new Error(
    'The in-app browser is not available yet. Please wait a moment and try again.',
  );
}

// ------------------------------------------------------------- command bus

export function validateUrl(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error(`Invalid URL: "${rawUrl}"`);
  }
  if (!ALLOWED_URL_PROTOCOLS.includes(parsed.protocol as (typeof ALLOWED_URL_PROTOCOLS)[number])) {
    throw new Error(`Only ${ALLOWED_URL_PROTOCOLS.join(', ')} URLs are allowed.`);
  }
  return parsed.toString();
}

export interface NavigationDecision {
  allowed: boolean;
  reason?: string;
}

/** Runtime WebView navigation guard: only https and internal about:blank. */
export function validateNavigationUrl(rawUrl: string): NavigationDecision {
  const trimmed = rawUrl.trim();
  if (trimmed === 'about:blank') {
    return { allowed: true };
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { allowed: false, reason: `Blocked invalid navigation URL: "${rawUrl}".` };
  }
  if (ALLOWED_URL_PROTOCOLS.includes(parsed.protocol as (typeof ALLOWED_URL_PROTOCOLS)[number])) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: `Blocked navigation to protocol "${parsed.protocol}". Only https: is allowed.`,
  };
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(command: BrowserCommand): void {
  for (const listener of listeners) {
    listener(command);
  }
}

/** Called by the open_url tool (after user confirmation). */
export function requestOpenUrl(rawUrl: string): string {
  const url = validateUrl(rawUrl);
  emit({ type: 'open_url', url });
  return url;
}

/** Called by the go_back tool. */
export function requestGoBack(): void {
  emit({ type: 'go_back' });
}

/** Called by the stop_loading tool. */
export function requestStopLoading(): void {
  emit({ type: 'stop_loading' });
}

/** Called by the Browser screen on navigation changes. */
export function reportNavigation(update: Partial<BrowserState>): void {
  Object.assign(state, update);
}

export function reportLoadStart(update: Partial<BrowserState> = {}): void {
  Object.assign(state, {
    ...update,
    loading: true,
    lastLoadStartedAt: Date.now(),
    lastError: undefined,
    lastHttpError: undefined,
  });
}

export function reportLoadEnd(update: Partial<BrowserState> = {}): void {
  Object.assign(state, {
    ...update,
    loading: false,
    lastLoadFinishedAt: Date.now(),
  });
}

export function reportLoadError(error: string, update: Partial<BrowserState> = {}): void {
  Object.assign(state, {
    ...update,
    loading: false,
    lastLoadFinishedAt: Date.now(),
    lastError: error,
  });
}

export function reportHttpError(error: string, update: Partial<BrowserState> = {}): void {
  Object.assign(state, {
    ...update,
    lastHttpError: error,
  });
}

/** Called by the Browser screen when it blocks a non-https navigation. */
export function reportBlockedNavigation(url: string, reason: string): void {
  state.lastBlockedUrl = url;
  state.lastBlockedReason = reason;
}

export function getState(): BrowserState {
  return { ...state };
}

function formatStateForError(current: BrowserState): string {
  return [
    `currentUrl=${current.currentUrl || '(unknown)'}`,
    `loading=${current.loading ? 'true' : 'false'}`,
    current.currentTitle ? `title="${current.currentTitle}"` : null,
    current.lastError ? `lastError="${current.lastError}"` : null,
    current.lastHttpError ? `lastHttpError="${current.lastHttpError}"` : null,
    current.lastBlockedUrl
      ? `lastBlocked="${current.lastBlockedUrl}" (${current.lastBlockedReason ?? 'blocked'})`
      : null,
  ]
    .filter(Boolean)
    .join(', ');
}

// ----------------------------------------------------------- script bridge

/** Registered by the Browser screen while mounted (injects into its WebView). */
export function setScriptRunner(runner: ScriptRunner | null): void {
  scriptRunner = runner;
  if (!runner) {
    for (const [id, request] of pending) {
      clearTimeout(request.timer);
      request.reject(new Error('Browser screen was closed while the command was running.'));
      pending.delete(id);
    }
  }
}

/**
 * Called by the Browser screen for every WebView message.
 * Returns true when the message belonged to the bridge.
 */
export function handleBridgeMessage(raw: string): boolean {
  let parsed: { __agentBridge?: boolean; id?: string; ok?: boolean; result?: unknown; error?: string };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    return false;
  }
  if (!parsed.__agentBridge || typeof parsed.id !== 'string') {
    return false;
  }
  const request = pending.get(parsed.id);
  if (!request) {
    return true; // late answer after timeout – already handled
  }
  pending.delete(parsed.id);
  clearTimeout(request.timer);
  if (parsed.ok) {
    request.resolve(parsed.result);
  } else {
    request.reject(new Error(parsed.error ?? 'Unknown error inside the page.'));
  }
  return true;
}

/**
 * Runs one of the fixed script templates below inside the page.
 * `body` must be a function body that returns a JSON-serializable value.
 */
async function executeScript<T>(body: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  await ensureBrowserReady();
  const runner = scriptRunner;
  return new Promise<T>((resolve, reject) => {
    if (!runner) {
      reject(new Error('The in-app browser is not available yet.'));
      return;
    }
    const id = generateId();
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(
        new Error(
          `Browser command timed out after ${timeoutMs} ms ` +
            '(page may still be loading or navigated away).',
        ),
      );
    }, timeoutMs);
    pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timer });

    const wrapped =
      '(function(){' +
      'var __post=function(p){window.ReactNativeWebView.postMessage(JSON.stringify(p));};' +
      'try{' +
      `var __r=(function(){${body}})();` +
      `__post({__agentBridge:true,id:${JSON.stringify(id)},ok:true,result:__r});` +
      '}catch(e){' +
      `__post({__agentBridge:true,id:${JSON.stringify(id)},ok:false,error:String(e&&e.message?e.message:e)});` +
      '}})();true;';
    runner(wrapped);
  });
}

// ------------------------------------------------------- script templates

/** Shared helpers injected into every DOM script (visibility + text cleanup). */
const HELPERS = `
function __vis(el){
  if(!el||el.nodeType!==1)return false;
  var s=window.getComputedStyle(el);
  if(s.display==='none'||s.visibility==='hidden'||s.opacity==='0')return false;
  return el.getClientRects().length>0;
}
function __clean(t){return (t||'').replace(/\\s+/g,' ').trim();}
function __label(el){
  return __clean(el.innerText||el.value||el.getAttribute('aria-label')||'');
}
`;

const READ_PAGE_SCRIPT = `
${HELPERS}
var MAX_TEXT=6000, MAX_LIST=50, MAX_HEADINGS=30;
var text=__clean(document.body?document.body.innerText:'');
if(text.length>MAX_TEXT)text=text.slice(0,MAX_TEXT)+' …[truncated]';
var headings=[];
var hs=document.querySelectorAll('h1,h2,h3,h4,h5,h6');
for(var i=0;i<hs.length&&headings.length<MAX_HEADINGS;i++){
  if(!__vis(hs[i]))continue;
  var ht=__clean(hs[i].innerText);
  if(ht)headings.push({level:parseInt(hs[i].tagName.slice(1),10),text:ht.slice(0,120)});
}
var links=[];
var as=document.querySelectorAll('a[href]');
for(var i=0;i<as.length&&links.length<MAX_LIST;i++){
  var a=as[i];
  if(!__vis(a))continue;
  var lt=__label(a);
  if(!lt||a.href.indexOf('javascript:')===0)continue;
  links.push({text:lt.slice(0,80),href:a.href});
}
var buttons=[];
var bs=document.querySelectorAll('button,[role="button"],input[type="submit"],input[type="button"]');
for(var i=0;i<bs.length&&buttons.length<MAX_LIST;i++){
  if(!__vis(bs[i]))continue;
  var bt=__label(bs[i]);
  if(bt)buttons.push({text:bt.slice(0,80)});
}
var inputs=[];
var ins=document.querySelectorAll('input,textarea,select,[contenteditable="true"]');
for(var i=0;i<ins.length&&inputs.length<MAX_LIST;i++){
  var el=ins[i];
  if(!__vis(el))continue;
  if(el.tagName==='INPUT'&&el.type==='hidden')continue;
  var entry={tag:el.tagName.toLowerCase()};
  if(el.type)entry.type=el.type;
  if(el.name)entry.name=el.name;
  if(el.id)entry.id=el.id;
  if(el.placeholder)entry.placeholder=el.placeholder;
  var al=el.getAttribute('aria-label');
  if(al)entry.ariaLabel=al;
  inputs.push(entry);
}
return {url:location.href,title:document.title,text:text,headings:headings,links:links,buttons:buttons,inputs:inputs};
`;

function clickScript(selectorOrText: string): string {
  return `
${HELPERS}
var target=${JSON.stringify(selectorOrText)};
var el=null;
try{el=document.querySelector(target);}catch(e){el=null;}
if(el&&!__vis(el))el=null;
if(!el){
  var needle=__clean(target).toLowerCase();
  if(needle){
    var cands=document.querySelectorAll('a,button,[role="button"],input[type="submit"],input[type="button"],summary,label,[onclick]');
    var exact=null,partial=null;
    for(var i=0;i<cands.length;i++){
      var c=cands[i];
      if(!__vis(c))continue;
      var t=__label(c).toLowerCase();
      if(!t)continue;
      if(t===needle){exact=c;break;}
      if(!partial&&t.indexOf(needle)!==-1)partial=c;
    }
    el=exact||partial;
  }
}
if(!el)throw new Error('No clickable element found for "'+target+'" (tried CSS selector and visible text).');
el.scrollIntoView({block:'center'});
el.click();
return {clicked:__label(el).slice(0,80)||el.tagName.toLowerCase(),tag:el.tagName.toLowerCase()};
`;
}

function typeScript(selector: string, text: string): string {
  return `
${HELPERS}
var sel=${JSON.stringify(selector)};
var txt=${JSON.stringify(text)};
var el=null;
try{el=document.querySelector(sel);}catch(e){el=null;}
if(!el)throw new Error('No element matches selector "'+sel+'".');
var tag=el.tagName.toLowerCase();
if(tag==='input'&&el.type==='password')throw new Error('Refusing to type into a password field (security rule).');
el.focus();
if(tag==='input'||tag==='textarea'){
  var proto=tag==='textarea'?window.HTMLTextAreaElement.prototype:window.HTMLInputElement.prototype;
  var d=Object.getOwnPropertyDescriptor(proto,'value');
  if(d&&d.set){d.set.call(el,txt);}else{el.value=txt;}
}else if(el.isContentEditable){
  el.textContent=txt;
}else{
  throw new Error('Element "'+sel+'" is not an input, textarea or contenteditable.');
}
el.dispatchEvent(new Event('input',{bubbles:true}));
el.dispatchEvent(new Event('change',{bubbles:true}));
return {typedChars:txt.length,into:tag+(el.name?'[name="'+el.name+'"]':'')};
`;
}

function submitScript(selector: string): string {
  return `
${HELPERS}
var sel=${JSON.stringify(selector)};
var el=null;
try{el=sel?document.querySelector(sel):null;}catch(e){el=null;}
var form=null;
if(el)form=el.tagName==='FORM'?el:el.closest('form');
if(!form){
  var active=document.activeElement;
  if(active&&active.closest)form=active.closest('form');
  if(!form&&active&&(active.tagName==='INPUT'||active.tagName==='TEXTAREA')){
    var o={key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true};
    active.dispatchEvent(new KeyboardEvent('keydown',o));
    active.dispatchEvent(new KeyboardEvent('keypress',o));
    active.dispatchEvent(new KeyboardEvent('keyup',o));
    return {submitted:'enter-key',target:active.tagName.toLowerCase()};
  }
}
if(!form)throw new Error('No form found'+(sel?' for selector "'+sel+'"':'')+' and no focused input for the Enter fallback.');
if(typeof form.requestSubmit==='function'){form.requestSubmit();}else{form.submit();}
return {submitted:'form',action:form.getAttribute('action')||location.href};
`;
}

function scrollScript(direction: 'up' | 'down'): string {
  return `
var delta=Math.round(window.innerHeight*0.85)*(${JSON.stringify(direction)}==='up'?-1:1);
window.scrollBy({top:delta,left:0,behavior:'smooth'});
return {scrollY:Math.max(0,Math.round(window.scrollY+delta)),pageHeight:Math.round(document.body?document.body.scrollHeight:0)};
`;
}

// ------------------------------------------------------- public browser API

interface RawSnapshot {
  url: string;
  title: string;
  text: string;
  headings: Array<{ level: number; text: string }>;
  links: Array<{ text: string; href: string }>;
  buttons: Array<{ text: string }>;
  inputs: PageSnapshot['inputs'];
}

/** Structured snapshot of the current page (visible content only, capped). */
export async function readPage(): Promise<PageSnapshot> {
  await ensureBrowserReady();
  let raw: RawSnapshot;
  try {
    raw = await executeScript<RawSnapshot>(READ_PAGE_SCRIPT, READ_PAGE_TIMEOUT_MS);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `${message}\n` +
        `Native browser state: ${formatStateForError(getState())}.\n` +
        'The page may still be loading, may have navigated during the command, or may block DOM JavaScript injection. Use browser_get_state or wait_for_page before trying again.',
    );
  }
  reportNavigation({ currentUrl: raw.url, currentTitle: raw.title });
  return {
    currentUrl: raw.url,
    currentTitle: raw.title,
    canGoBack: state.canGoBack,
    text: raw.text,
    headings: raw.headings,
    links: raw.links,
    buttons: raw.buttons,
    inputs: raw.inputs,
  };
}

/** Clicks by CSS selector first, then by visible text (links/buttons/etc.). */
export async function clickElement(
  selectorOrText: string,
): Promise<{ clicked: string; tag: string }> {
  return executeScript(clickScript(selectorOrText));
}

/**
 * Heuristic guard: refuse text that looks like a secret (API key, token, …).
 * The in-page script already refuses password input fields; this adds a
 * content-based check so credentials are not auto-typed into normal fields.
 */
function looksLikeSecret(text: string): boolean {
  const value = text.trim();
  if (value.length === 0 || /\s/.test(value) || value.includes('@')) {
    return false; // sentences and email addresses are fine
  }
  // Known credential prefixes (OpenAI, GitHub, Slack, Google, AWS, …).
  if (/^(sk-|rk-|ghp_|gho_|github_pat_|xox[baprs]-|AIza|ya29\.|AKIA|eyJ)/.test(value)) {
    return true;
  }
  // Long high-entropy token: mixed letters+digits, no spaces, key-like charset.
  if (
    value.length >= 25 &&
    /^[A-Za-z0-9_\-.]+$/.test(value) &&
    /[0-9]/.test(value) &&
    /[A-Za-z]/.test(value)
  ) {
    return true;
  }
  return false;
}

/** Types into input/textarea/contenteditable and fires input+change events. */
export async function typeText(
  selector: string,
  text: string,
): Promise<{ typedChars: number; into: string }> {
  if (looksLikeSecret(text)) {
    throw new Error(
      'Refusing to type text that looks like a password, API key or token. ' +
        'Enter such secrets manually in the Browser tab.',
    );
  }
  return executeScript(typeScript(selector, text));
}

/** Submits a form (requestSubmit) or falls back to Enter on the active input. */
export async function submitForm(
  selector: string,
): Promise<{ submitted: string; target?: string; action?: string }> {
  return executeScript(submitScript(selector));
}

/** Scrolls roughly one viewport up or down. */
export async function scrollPage(
  direction: 'up' | 'down',
): Promise<{ scrollY: number; pageHeight: number }> {
  return executeScript(scrollScript(direction));
}

/** Waits (100-10000 ms, default 1500) and reports native WebView state. */
export async function waitForPage(ms?: number): Promise<BrowserState> {
  await ensureBrowserReady();
  const delay = Math.min(10000, Math.max(100, ms ?? 1500));
  await new Promise((resolve) => setTimeout(resolve, delay));
  return getState();
}
