import * as browserService from '../../services/browser/browserService';
import type { BrowserToolName, ToolHandler } from '../../types/tools';
import { requireString } from './paramHelpers';

function notImplemented(tool: string): { ok: false; output: string } {
  return {
    ok: false,
    output: `Tool "${tool}" is not implemented yet (MVP). See docs/TASKS.md for the roadmap.`,
  };
}

/**
 * Browser tools drive the in-app WebView through browserService.
 * DOM-level interaction is intentionally stubbed out in the MVP –
 * the tool names and signatures are final, the implementations are not.
 */
export const browserToolHandlers: Record<BrowserToolName, ToolHandler> = {
  open_url: async (params) => {
    const url = browserService.requestOpenUrl(requireString(params, 'url'));
    return {
      ok: true,
      output: `Opening "${url}" in the mini browser (switch to the Browser tab to watch).`,
    };
  },

  read_page: async () => {
    const state = browserService.getState();
    return {
      ok: true,
      output: `Current page: ${state.currentUrl}${state.currentTitle ? ` – "${state.currentTitle}"` : ''}. Full text extraction is not implemented yet (MVP).`,
      data: state,
    };
  },

  click_element: async () => notImplemented('click_element'),
  type_text: async () => notImplemented('type_text'),
  submit_form: async () => notImplemented('submit_form'),

  go_back: async () => {
    browserService.requestGoBack();
    return { ok: true, output: 'Navigated back in the mini browser.' };
  },

  screenshot_page: async () => notImplemented('screenshot_page'),
  download_file: async () => notImplemented('download_file'),
};
