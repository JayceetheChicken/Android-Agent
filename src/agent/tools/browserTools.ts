import * as browserService from '../../services/browser/browserService';
import type { BrowserToolName, ToolHandler } from '../../types/tools';
import { optionalNumber, optionalString, requireString } from './paramHelpers';

function notImplemented(tool: string): { ok: false; output: string } {
  return {
    ok: false,
    output: `Tool "${tool}" is not implemented yet. See docs/TASKS.md for the roadmap.`,
  };
}

function formatSnapshot(page: browserService.PageSnapshot): string {
  const lines: string[] = [
    `URL: ${page.currentUrl}`,
    `Title: ${page.currentTitle || '(no title)'}`,
  ];
  if (page.metaDescription) {
    lines.push(`Meta description: ${page.metaDescription}`);
  }
  if (page.headings.length > 0) {
    lines.push(
      '',
      'Headings:',
      ...page.headings.slice(0, 15).map((h) => `  ${'#'.repeat(h.level)} ${h.text}`),
    );
  }
  lines.push('', 'Visible text:', page.text || '(empty page)');
  if (page.links.length > 0) {
    lines.push(
      '',
      `Links (${page.links.length}${page.links.length === 50 ? '+, capped' : ''}):`,
      ...page.links.slice(0, 20).map((l) => `  - "${l.text}" -> ${l.href}`),
    );
    if (page.links.length > 20) {
      lines.push(`  ... ${page.links.length - 20} more in data.links`);
    }
  }
  if (page.buttons.length > 0) {
    lines.push(
      '',
      `Buttons (${page.buttons.length}):`,
      ...page.buttons.slice(0, 15).map((b) => `  - "${b.text}"`),
    );
  }
  if (page.inputs.length > 0) {
    lines.push(
      '',
      `Inputs (${page.inputs.length}):`,
      ...page.inputs.slice(0, 15).map((input) => {
        const attrs = [
          input.type && `type=${input.type}`,
          input.name && `name="${input.name}"`,
          input.id && `id="${input.id}"`,
          input.placeholder && `placeholder="${input.placeholder}"`,
          input.ariaLabel && `aria-label="${input.ariaLabel}"`,
        ]
          .filter(Boolean)
          .join(' ');
        return `  - <${input.tag}${attrs ? ' ' + attrs : ''}>`;
      }),
    );
  }
  return lines.join('\n');
}

function formatBrowserState(state: browserService.BrowserState): string {
  const lines = [
    `URL: ${state.currentUrl || '(unknown)'}`,
    `Title: ${state.currentTitle || '(no title)'}`,
    `History: ${state.canGoBack ? 'can go back' : 'no back entry'}`,
    `Load state: ${state.loading ? 'still loading' : 'load finished'}`,
  ];
  if (state.lastLoadStartedAt) {
    lines.push(`Last load started: ${new Date(state.lastLoadStartedAt).toISOString()}`);
  }
  if (state.lastLoadFinishedAt) {
    lines.push(`Last load finished: ${new Date(state.lastLoadFinishedAt).toISOString()}`);
  }
  if (state.lastError) {
    lines.push(`Last error: ${state.lastError}`);
  }
  if (state.lastHttpError) {
    lines.push(`Last HTTP error: ${state.lastHttpError}`);
  }
  if (state.lastBlockedUrl) {
    lines.push(
      `Last blocked navigation: ${state.lastBlockedUrl} (${state.lastBlockedReason ?? 'blocked'})`,
    );
  }
  return lines.join('\n');
}

function formatFetchedPage(page: browserService.FetchedPageText): string {
  const lines: string[] = [
    `URL: ${page.url}`,
    `HTTP status: ${page.status}`,
    `Title: ${page.title || '(no title)'}`,
    `HTML length: ${page.htmlLength}`,
  ];
  if (page.metaDescription) {
    lines.push(`Meta description: ${page.metaDescription}`);
  }
  if (page.headings.length > 0) {
    lines.push(
      '',
      'Headings:',
      ...page.headings.slice(0, 15).map((h) => `  ${'#'.repeat(h.level)} ${h.text}`),
    );
  }
  if (page.links.length > 0) {
    lines.push(
      '',
      `Links (${page.links.length}${page.links.length === 40 ? '+, capped' : ''}):`,
      ...page.links.slice(0, 20).map((l) => `  - "${l.text}" -> ${l.href}`),
    );
  }
  lines.push('', 'Fetched text:', page.text || '(empty HTML text)');
  return lines.join('\n');
}

/**
 * Browser tools drive the in-app WebView exclusively through browserService's
 * promise-based script bridge. Tools never see the WebView, never run
 * free-form code (fixed script templates only) and never bypass the risky
 * confirmation flow (open_url and submit_form stay risky).
 */
export const browserToolHandlers: Record<BrowserToolName, ToolHandler> = {
  open_url: async (params) => {
    await browserService.ensureBrowserReady();
    const url = browserService.requestOpenUrl(requireString(params, 'url'));
    return {
      ok: true,
      output: `Opening "${url}" in the mini browser. Next: wait_for_page, then read_page.`,
    };
  },

  read_page: async () => {
    try {
      const page = await browserService.readPage();
      return { ok: true, output: formatSnapshot(page), data: page };
    } catch (error) {
      const state = browserService.getState();
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        output: `${message}\n\nCurrent native browser state:\n${formatBrowserState(state)}`,
        data: state,
      };
    }
  },

  click_element: async (params) => {
    const selector = requireString(params, 'selector');
    const result = await browserService.clickElement(selector);
    return {
      ok: true,
      output: `Clicked <${result.tag}> "${result.clicked}". Next: wait_for_page, then read_page.`,
      data: result,
    };
  },

  type_text: async (params) => {
    const selector = requireString(params, 'selector');
    const text = requireString(params, 'text');
    const result = await browserService.typeText(selector, text);
    return {
      ok: true,
      output: `Typed ${result.typedChars} characters into ${result.into}.`,
      data: result,
    };
  },

  submit_form: async (params) => {
    const selector = optionalString(params, 'selector');
    const result = await browserService.submitForm(selector);
    return {
      ok: true,
      output:
        result.submitted === 'form'
          ? `Submitted form (action: ${result.action ?? 'unknown'}). Next: wait_for_page, then read_page.`
          : `No form matched - sent Enter key to the focused <${result.target ?? 'input'}>. Next: wait_for_page, then read_page.`,
      data: result,
    };
  },

  scroll_page: async (params) => {
    const direction = requireString(params, 'direction');
    if (direction !== 'up' && direction !== 'down') {
      return { ok: false, output: `Invalid direction "${direction}". Use "up" or "down".` };
    }
    const result = await browserService.scrollPage(direction);
    return {
      ok: true,
      output: `Scrolled ${direction} to ~${result.scrollY}px of ${result.pageHeight}px page height.`,
      data: result,
    };
  },

  wait_for_page: async (params) => {
    const ms = optionalNumber(params, 'ms');
    const result = await browserService.waitForPage(ms);
    return {
      ok: true,
      output: `Native page state after waiting:\n${formatBrowserState(result)}`,
      data: result,
    };
  },

  browser_get_state: async () => {
    await browserService.ensureBrowserReady();
    const state = browserService.getState();
    return {
      ok: true,
      output: `Current native browser state:\n${formatBrowserState(state)}`,
      data: state,
    };
  },

  fetch_current_page_text: async (params) => {
    const maxChars = optionalNumber(params, 'max_chars');
    const page = await browserService.fetchCurrentPageText(maxChars);
    return {
      ok: true,
      output: formatFetchedPage(page),
      data: page,
    };
  },

  go_back: async () => {
    await browserService.ensureBrowserReady();
    browserService.requestGoBack();
    return {
      ok: true,
      output: 'Navigated back in the mini browser. Next: wait_for_page, then read_page.',
    };
  },

  stop_loading: async () => {
    await browserService.ensureBrowserReady();
    browserService.requestStopLoading();
    const state = browserService.getState();
    return {
      ok: true,
      output: `Stopped loading the current page.\n${formatBrowserState(state)}`,
      data: state,
    };
  },

  screenshot_page: async () => notImplemented('screenshot_page'),
  download_file: async () => notImplemented('download_file'),
};
