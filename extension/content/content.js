/**
 * Content Script — Cloud Text Expander
 *
 * Text expansion engine:
 * - Instant expansion on typing shortcut (e.g. /alex, /welcome, /interview)
 * - Delimiter expansion on Space, Enter, or Tab
 * - Full support for <input>, <textarea>, and contenteditable (Gmail, Slack, WhatsApp, Notion, etc.)
 * - React, Vue, Angular, and native Undo (Ctrl+Z) compatibility
 */

console.log('[Cloud Text Expander] Content script loaded on:', window.location.hostname);

const DUMMY_CAN_IDS = new Set(['can-welcome', 'can-hi', 'can-alex', 'sample-1', 'sample-2', 'sample-3']);

let allCans = {};
let sortedShortcuts = [];
let keyBuffer = '';
const BUFFER_LIMIT = 40;
let isExpanding = false; // Guard against recursive expansion loops

// ── Initialization & Storage Sync ───────────────────────────────────────────

function updateCansDictionary(personalCans, orgCans) {
  const newCans = {};

  function register(sc, content) {
    if (!sc || typeof sc !== 'string' || content === undefined || content === null) return;
    const clean = sc.toLowerCase().trim();
    if (!clean) return;

    newCans[clean] = String(content);

    // Also register alternate format with/without slash
    if (clean.startsWith('/')) {
      newCans[clean.slice(1)] = String(content);
    } else {
      newCans['/' + clean] = String(content);
    }
  }

  // Lower priority (Org cans)
  if (Array.isArray(orgCans)) {
    orgCans.forEach(can => {
      if (can && can.shortcut && (!can.id || !DUMMY_CAN_IDS.has(can.id))) {
        register(can.shortcut, can.content);
      }
    });
  }

  // Higher priority (Personal cans override)
  if (Array.isArray(personalCans)) {
    personalCans.forEach(can => {
      if (can && can.shortcut && (!can.id || !DUMMY_CAN_IDS.has(can.id))) {
        register(can.shortcut, can.content);
      }
    });
  }

  allCans = newCans;
  sortedShortcuts = Object.keys(allCans).sort((a, b) => b.length - a.length);
  console.log('[Cloud Text Expander] Dictionary updated with', Object.keys(allCans).length, 'active shortcuts');
}

// Initial load from storage
if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
  chrome.storage.local.get(['personalCans', 'orgCans'], (result) => {
    updateCansDictionary(result?.personalCans || [], result?.orgCans || []);
  });

  // Listen for real-time storage changes
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && (changes.personalCans || changes.orgCans)) {
      chrome.storage.local.get(['personalCans', 'orgCans'], (result) => {
        updateCansDictionary(result?.personalCans || [], result?.orgCans || []);
      });
    }
  });
}

// ── Helper: Editable Target Detection ──────────────────────────────────────

function getActiveEditableElement(target) {
  if (!target) target = document.activeElement;
  if (!target) return null;

  // Handle Shadow DOM
  if (target.shadowRoot && target.shadowRoot.activeElement) {
    return getActiveEditableElement(target.shadowRoot.activeElement);
  }

  if (target instanceof HTMLTextAreaElement) return target;
  if (target instanceof HTMLInputElement) {
    const validTypes = ['text', 'search', 'email', 'tel', 'url', 'password', ''];
    const type = (target.type || '').toLowerCase();
    if (validTypes.includes(type) || !target.type) return target;
  }

  if (target.isContentEditable) return target;

  const contentEditableAncestor = target.closest?.('[contenteditable="true"], [contenteditable=""], [role="textbox"], [role="combobox"]');
  if (contentEditableAncestor) return contentEditableAncestor;

  return null;
}

// ── Text Extraction & Matching ──────────────────────────────────────────────

function getTextBeforeCursor(el) {
  if (!el) return '';

  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    try {
      const pos = el.selectionStart;
      if (typeof pos === 'number') {
        return (el.value || '').substring(0, pos);
      }
    } catch (e) {
      // Fallback for inputs that disallow selectionStart (e.g. type="email" on older engines)
      return el.value || '';
    }
  }

  // ContentEditable selection
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    let node = range.startContainer;
    let offset = range.startOffset;

    if (node.nodeType === Node.TEXT_NODE) {
      return (node.textContent || '').substring(0, offset);
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      if (offset > 0 && node.childNodes.length >= offset) {
        let child = node.childNodes[offset - 1];
        while (child && child.lastChild) {
          child = child.lastChild;
        }
        if (child && child.nodeType === Node.TEXT_NODE) {
          return child.textContent || '';
        }
      }
    }
  }

  return '';
}

function findMatchingShortcut(text) {
  if (!text) return null;
  const normalized = text.replace(/\u00a0/g, ' ').toLowerCase();

  for (const shortcut of sortedShortcuts) {
    if (normalized.endsWith(shortcut)) {
      return shortcut;
    }
  }
  return null;
}

// ── Text Replacement Engine ─────────────────────────────────────────────────

function performExpansion(target, shortcut, expansionText, appendChar = '') {
  if (isExpanding) return false;
  isExpanding = true;

  try {
    const fullReplacement = expansionText + appendChar;
    const isStandardInput = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;

    if (isStandardInput) {
      replaceInStandardInput(target, shortcut, fullReplacement);
    } else {
      replaceInContentEditable(target, shortcut, fullReplacement);
    }

    keyBuffer = '';
    return true;
  } catch (err) {
    console.error('[Cloud Text Expander] Replacement error:', err);
    return false;
  } finally {
    setTimeout(() => { isExpanding = false; }, 30);
  }
}

function replaceInStandardInput(input, shortcut, replacementText) {
  let start = null;
  let end = null;
  let hasSelectionApi = true;

  try {
    start = input.selectionStart;
    end = input.selectionEnd;
  } catch (e) {
    hasSelectionApi = false;
  }

  const val = input.value || '';

  // If selectionStart is not supported or null
  if (!hasSelectionApi || start === null) {
    if (val.toLowerCase().endsWith(shortcut)) {
      const newVal = val.slice(0, val.length - shortcut.length) + replacementText;
      applyNativeInputValue(input, newVal);
    }
    return;
  }

  const textBefore = val.substring(0, start);
  if (!textBefore.toLowerCase().endsWith(shortcut)) {
    return;
  }

  const matchStart = start - shortcut.length;

  // 1. Preferred method: execCommand with text selected (preserves native Undo & triggers React synthetic events)
  input.focus();
  input.setSelectionRange(matchStart, end);
  let execSuccess = false;
  try {
    execSuccess = document.execCommand('insertText', false, replacementText);
  } catch (e) {
    execSuccess = false;
  }

  if (execSuccess) {
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }

  // 2. Fallback: setRangeText
  try {
    input.setRangeText(replacementText, matchStart, end, 'end');
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: replacementText }));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  } catch (e) {}

  // 3. Fallback: Native Prototype Setter for React / Angular
  const textAfter = val.substring(end);
  const newVal = textBefore.substring(0, matchStart) + replacementText + textAfter;
  applyNativeInputValue(input, newVal);

  const newPos = matchStart + replacementText.length;
  try {
    input.setSelectionRange(newPos, newPos);
  } catch (e) {}
}

function applyNativeInputValue(input, newVal) {
  const isTextArea = input instanceof HTMLTextAreaElement;
  const proto = isTextArea ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');

  if (descriptor && descriptor.set) {
    descriptor.set.call(input, newVal);
  } else {
    input.value = newVal;
  }

  input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function replaceInContentEditable(element, shortcut, replacementText) {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return;

  const range = selection.getRangeAt(0);
  let node = range.startContainer;
  let offset = range.startOffset;

  // Navigate to actual text node if cursor is placed at element level
  if (node.nodeType === Node.ELEMENT_NODE) {
    if (offset > 0 && node.childNodes.length >= offset) {
      let child = node.childNodes[offset - 1];
      while (child && child.lastChild) {
        child = child.lastChild;
      }
      if (child && child.nodeType === Node.TEXT_NODE) {
        node = child;
        offset = child.textContent.length;
      }
    }
  }

  if (node && node.nodeType === Node.TEXT_NODE) {
    const textBefore = (node.textContent || '').substring(0, offset);
    const normalizedText = textBefore.replace(/\u00a0/g, ' ');
    const normalizedShortcut = shortcut.replace(/\u00a0/g, ' ');

    if (normalizedText.toLowerCase().endsWith(normalizedShortcut.toLowerCase())) {
      const matchStart = Math.max(0, offset - shortcut.length);
      const replaceRange = document.createRange();
      replaceRange.setStart(node, matchStart);
      replaceRange.setEnd(node, offset);

      selection.removeAllRanges();
      selection.addRange(replaceRange);

      let success = false;
      try {
        success = document.execCommand('insertText', false, replacementText);
      } catch (e) {
        success = false;
      }

      if (!success) {
        replaceRange.deleteContents();
        const textNode = document.createTextNode(replacementText);
        replaceRange.insertNode(textNode);
        replaceRange.setStartAfter(textNode);
        replaceRange.setEndAfter(textNode);
        selection.removeAllRanges();
        selection.addRange(replaceRange);
      }

      element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
      element.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
  }

  // Cross-node fallback replacement
  replaceAcrossNodes(element, shortcut, replacementText);
}

function replaceAcrossNodes(element, shortcut, replacementText) {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return;

  const range = selection.getRangeAt(0);
  const replaceRange = document.createRange();
  replaceRange.setStart(element, 0);
  replaceRange.setEnd(range.startContainer, range.startOffset);

  const fullText = replaceRange.toString().replace(/\u00a0/g, ' ');
  if (!fullText.toLowerCase().endsWith(shortcut.toLowerCase())) return;

  // Let execCommand try selecting and inserting
  let charsRemaining = shortcut.length;
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const textNodes = [];

  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
  }

  // Find where the shortcut starts and ends
  let endNode = range.startContainer;
  let endOffset = range.startOffset;
  let startNode = null;
  let startOffset = 0;

  for (let i = textNodes.length - 1; i >= 0; i--) {
    const tn = textNodes[i];
    const len = (tn === endNode) ? endOffset : tn.textContent.length;
    if (len >= charsRemaining) {
      startNode = tn;
      startOffset = len - charsRemaining;
      break;
    } else {
      charsRemaining -= len;
    }
  }

  if (startNode) {
    const finalRange = document.createRange();
    finalRange.setStart(startNode, startOffset);
    finalRange.setEnd(endNode, endOffset);

    selection.removeAllRanges();
    selection.addRange(finalRange);

    const ok = document.execCommand('insertText', false, replacementText);
    if (!ok) {
      finalRange.deleteContents();
      const node = document.createTextNode(replacementText);
      finalRange.insertNode(node);
      finalRange.setStartAfter(node);
      finalRange.setEndAfter(node);
      selection.removeAllRanges();
      selection.addRange(finalRange);
    }

    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

// ── Event Handlers ──────────────────────────────────────────────────────────

// 1. Keydown Listener — Handles Delimiters (Space, Enter, Tab) and Instant Shortcut typing
document.addEventListener('keydown', (e) => {
  if (isExpanding) return;
  if (e.key === 'Control' || e.key === 'Alt' || e.key === 'Shift' || e.key === 'Meta') return;

  const target = getActiveEditableElement(e.target);
  if (!target) {
    keyBuffer = '';
    return;
  }

  const isTriggerKey = e.key === ' ' || e.key === 'Enter' || e.key === 'Tab';

  if (isTriggerKey) {
    const domText = getTextBeforeCursor(target);
    const match = findMatchingShortcut(domText) || findMatchingShortcut(keyBuffer);

    if (match) {
      e.preventDefault();
      e.stopPropagation();

      const expansionText = allCans[match];
      let triggerChar = '';
      if (e.key === ' ') triggerChar = ' ';
      else if (e.key === 'Enter') triggerChar = (target instanceof HTMLTextAreaElement || target.isContentEditable) ? '\n' : '';
      else if (e.key === 'Tab') triggerChar = '';

      performExpansion(target, match, expansionText, triggerChar);
      return;
    }

    // Reset buffer on delimiter if no match
    keyBuffer = '';
    return;
  }

  if (e.key === 'Backspace') {
    keyBuffer = keyBuffer.slice(0, -1);
    return;
  }

  if (e.key.length === 1) {
    keyBuffer += e.key.toLowerCase();
    if (keyBuffer.length > BUFFER_LIMIT) {
      keyBuffer = keyBuffer.slice(keyBuffer.length - BUFFER_LIMIT);
    }

    // Check for INSTANT EXPANSION (as soon as the shortcut is completed!)
    // If the typed character completes a shortcut (especially ones starting with '/')
    const domText = getTextBeforeCursor(target);
    const prospectiveText = (domText ? domText + e.key : keyBuffer).toLowerCase();

    for (const shortcut of sortedShortcuts) {
      if (prospectiveText.endsWith(shortcut)) {
        // Expand immediately!
        e.preventDefault();
        e.stopPropagation();

        const expansionText = allCans[shortcut];
        // Replace previous part of shortcut in DOM plus don't insert e.key
        const prevPart = shortcut.slice(0, -1);
        performExpansion(target, prevPart, expansionText, '');
        return;
      }
    }
  } else {
    // Control keys reset the buffer
    keyBuffer = '';
  }
}, true);

// 2. Input Event Listener — Catches instant expansion on text changes (IME, paste, rapid typing)
document.addEventListener('input', (e) => {
  if (isExpanding) return;

  const target = getActiveEditableElement(e.target);
  if (!target) return;

  const textBefore = getTextBeforeCursor(target);
  if (!textBefore) return;

  // Check if current text ends with any registered shortcut
  const match = findMatchingShortcut(textBefore);
  if (match) {
    // Only auto-expand instantly if shortcut starts with a prefix or is exact registered shortcut
    const expansionText = allCans[match];
    performExpansion(target, match, expansionText, '');
  }
}, true);

// Reset buffer on click/blur
document.addEventListener('mousedown', () => { keyBuffer = ''; }, true);
document.addEventListener('focusin', () => { keyBuffer = ''; }, true);
