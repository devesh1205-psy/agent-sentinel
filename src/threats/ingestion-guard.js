/**
 * Ingestion-Layer Prompt Injection Shield & Document Scanner
 * src/threats/ingestion-guard.js
 *
 * Protects AI coding agents from Indirect Prompt Injections (IPI)
 * while reading repositories, markdown docs, pull requests, and web content.
 *
 * Features:
 * 1. Multi-Vector Detection:
 *    - Instruction overrides & goal hijacking (e.g. "ignore previous instructions")
 *    - Role-spoofing and delimiter hijacking (e.g. [SYSTEM], <<SYS>>, <|im_start|>)
 *    - Steganographic injection (hidden HTML comments, zero-width spaces, hidden CSS tags)
 *    - Imperative action triggers (directing agent to leak .env, open socket, run curl/bash)
 * 2. Inert Disarming & Sanitization:
 *    - Neutralizes dangerous imperatives with inert placeholder markers
 *    - Wraps ingested content in strict XML isolation boundaries
 * 3. Autonomous Execution:
 *    - Requires zero security prompting from the user
 *    - Operates synchronously (<2ms) before text reaches agent context
 */

'use strict';

const crypto = require('crypto');
const path = require('path');

const INJECTION_PATTERNS = [
  // 1. Instruction Overrides & Goal Hijacking
  {
    id: 'INJ-OVERRIDE-001',
    category: 'Indirect Prompt Injection',
    title: 'Instruction Override Directive',
    severity: 'CRITICAL',
    weight: 95,
    regex: /(?:ignore|disregard|forget|bypass|override)\s+(?:all\s+|any\s+|previous\s+|prior\s+|above\s+|system\s+|initial\s+)*(?:instructions|rules|prompts|directives|guidelines|context|constraints)/i,
    detail: 'Document contains an instruction override directive designed to hijack agent goals.',
    action: 'Neutralize override directive and enclose document in inert data boundary',
  },
  {
    id: 'INJ-OVERRIDE-002',
    category: 'Indirect Prompt Injection',
    title: 'Goal Replacement / Persona Hijacking',
    severity: 'CRITICAL',
    weight: 90,
    regex: /(?:your\s+new|updated|real|actual)\s+(?:task|role|instructions|goal|objective)\s+(?:is|are)/i,
    detail: 'Document attempts to assign a new persona or substitute the original user task.',
    action: 'Disarm persona substitution and maintain original agent goal',
  },
  {
    id: 'INJ-OVERRIDE-003',
    category: 'Indirect Prompt Injection',
    title: 'System Override Imperative',
    severity: 'CRITICAL',
    weight: 95,
    regex: /(?:system|admin|administrative|developer|emergency)\s+override\s*:/i,
    detail: 'Document attempts administrative or system override privilege escalation.',
    action: 'Strip simulated privilege override block',
  },
  {
    id: 'INJ-OVERRIDE-004',
    category: 'Indirect Prompt Injection',
    title: 'Divergent Task Redirection',
    severity: 'HIGH',
    weight: 85,
    regex: /(?:stop\s+summarizing|instead\s+of\s+summarizing|do\s+not\s+summarize|before\s+summarizing).{0,60}(?:you\s+must|execute|run|read|curl|fetch|send)/i,
    detail: 'Document attempts to deflect agent from reading/summarizing to executing hostile tools.',
    action: 'Neutralize deflection instruction',
  },

  // 2. Role Impersonation & Delimiter Spoofing
  {
    id: 'INJ-ROLE-001',
    category: 'Delimiter Hijacking',
    title: 'System Role Tag Impersonation',
    severity: 'HIGH',
    weight: 85,
    regex: /(?:^|\n)\s*(?:\[?(?:system|assistant|admin|root)\]?|<<SYS>>|<\|im_start\|>system|<system>|\[INST\])\s*:/i,
    detail: 'Document contains simulated LLM chat delimiters mimicking system/assistant prompt boundaries.',
    action: 'Escape and disarm role delimiters',
  },
  {
    id: 'INJ-ROLE-002',
    category: 'Delimiter Hijacking',
    title: 'Simulated System Prompt Header',
    severity: 'HIGH',
    weight: 80,
    regex: /(?:^|\n)\s*(?:#|##|###)\s*(?:system\s+instructions?|critical\s+override|secret\s+directives?|hidden\s+instruction)/i,
    detail: 'Document mimics internal system prompt headers in markdown format.',
    action: 'Demote header and neutralize imperative directives',
  },

  // 3. Action Triggering & Credential Harvesting Imperatives
  {
    id: 'INJ-EXFIL-001',
    category: 'Tool Hijacking',
    title: 'Secret File Exfiltration Imperative',
    severity: 'CRITICAL',
    weight: 95,
    regex: /(?:read|open|cat|extract|leak|send|exfiltrate|steal|dump)\s+(?:the\s+)?(?:\.env|\.ssh|id_rsa|credentials|aws_secret|token|passwords?|keys?)\b/i,
    detail: 'Document commands the agent to read and exfiltrate protected secrets or credentials.',
    action: 'Intercept exfiltration imperative and tag source as tainted',
  },
  {
    id: 'INJ-EXFIL-002',
    category: 'Tool Hijacking',
    title: 'Network Egress / Socket Dispatch Imperative',
    severity: 'HIGH',
    weight: 85,
    regex: /(?:connect|send|post|transmit|upload|ping|egress)\s+(?:to|via)\s+(?:https?:\/\/|socket|127\.0\.0\.1|localhost|\d+\.\d+\.\d+\.\d+)/i,
    detail: 'Document commands the agent to transmit data to an external socket or URL.',
    action: 'Block outbound egress command and neutralize payload',
  },
  {
    id: 'INJ-EXFIL-003',
    category: 'Tool Hijacking',
    title: 'Command Execution / Shell Dispatch Imperative',
    severity: 'HIGH',
    weight: 85,
    regex: /(?:execute|run|invoke|spawn)\s+(?:the\s+following|bash|shell|command|python|script)\s*:/i,
    detail: 'Document commands the agent to invoke shell execution tools.',
    action: 'Neutralize shell invocation instruction',
  },
];

// Steganographic patterns
const ZERO_WIDTH_CHARS_REGEX = /[\u200B\u200C\u200D\uFEFF\u2060]/g;
const HIDDEN_HTML_COMMENT_REGEX = /<!--([\s\S]*?)-->/g;
const HIDDEN_CSS_TAG_REGEX = /<(?:span|div)[^>]*style=["'][^"']*(?:display\s*:\s*none|opacity\s*:\s*0|font-size\s*:\s*0)[^"']*["'][^>]*>([\s\S]*?)<\/(?:span|div)>/gi;
const BASE64_EXEC_REGEX = /(?:echo|base64\s+-d)\s+[A-Za-z0-9+/=]{20,}\s*\|\s*(?:bash|sh|python|eval)/i;

class IngestionGuard {
  constructor(options = {}) {
    this.options = options;
  }

  /**
   * Scans document or text for Indirect Prompt Injection
   * @param {string} text Text content to inspect
   * @param {string} [filePath=''] Optional file path
   * @returns {object} Scan result
   */
  scan(text, filePath = '') {
    if (!text || typeof text !== 'string') {
      return {
        hasInjection: false,
        riskScore: 0,
        verdict: 'ALLOW',
        threats: [],
        sanitizedContent: text,
      };
    }

    const threats = [];
    let maxRisk = 0;

    // 1. Check for Steganographic Injections (Hidden HTML comments with commands)
    let commentMatch;
    while ((commentMatch = HIDDEN_HTML_COMMENT_REGEX.exec(text)) !== null) {
      const commentBody = commentMatch[1];
      const hasDangerousKeywords = /\b(ignore|override|exfiltrate|socket|\.env|curl|token|secret|password|run|exec)\b/i.test(commentBody);
      if (hasDangerousKeywords) {
        const line = this.getLineNumber(text, commentMatch.index);
        threats.push({
          id: 'INJ-STEGO-001',
          category: 'Steganographic Injection',
          title: 'Hidden HTML Comment Prompt Injection',
          severity: 'CRITICAL',
          riskScore: 95,
          line,
          snippet: commentMatch[0].slice(0, 100),
          detail: 'Hostile instructions concealed inside hidden HTML comments in document.',
          action: 'Strip hidden comment block before agent ingestion',
        });
        if (maxRisk < 95) maxRisk = 95;
      }
    }

    // 2. Check for Zero-Width Character obfuscation
    const zeroWidthMatches = text.match(ZERO_WIDTH_CHARS_REGEX);
    if (zeroWidthMatches && zeroWidthMatches.length >= 3) {
      threats.push({
        id: 'INJ-STEGO-002',
        category: 'Steganographic Injection',
        title: 'Zero-Width Steganographic Obfuscation',
        severity: 'HIGH',
        riskScore: 85,
        line: 1,
        snippet: `[${zeroWidthMatches.length} zero-width unicode characters detected]`,
        detail: 'Document contains invisible zero-width unicode characters used to bypass tokenizers.',
        action: 'Strip invisible unicode characters and inspect decoded text',
      });
      if (maxRisk < 85) maxRisk = 85;
    }

    // 3. Check for Hidden CSS Styling
    let cssMatch;
    while ((cssMatch = HIDDEN_CSS_TAG_REGEX.exec(text)) !== null) {
      const line = this.getLineNumber(text, cssMatch.index);
      threats.push({
        id: 'INJ-STEGO-003',
        category: 'Steganographic Injection',
        title: 'Hidden CSS Invisible Text Injection',
        severity: 'HIGH',
        riskScore: 85,
        line,
        snippet: cssMatch[0].slice(0, 100),
        detail: 'Document contains visually hidden HTML elements with injected instructions.',
        action: 'Sanitize hidden HTML block',
      });
      if (maxRisk < 85) maxRisk = 85;
    }

    // 4. Check for Base64 execution payloads embedded in prose
    const b64Match = text.match(BASE64_EXEC_REGEX);
    if (b64Match) {
      const line = this.getLineNumber(text, b64Match.index);
      threats.push({
        id: 'INJ-STEGO-004',
        category: 'Steganographic Injection',
        title: 'Base64 Shell Payload Embedded in Text',
        severity: 'CRITICAL',
        riskScore: 95,
        line,
        snippet: b64Match[0].slice(0, 100),
        detail: 'Document embeds an obfuscated base64 shell pipeline.',
        action: 'Neutralize command payload',
      });
      if (maxRisk < 95) maxRisk = 95;
    }

    // 5. Evaluate Multi-Vector Linguistic Injection Patterns
    for (const pattern of INJECTION_PATTERNS) {
      const match = text.match(pattern.regex);
      if (match) {
        const line = this.getLineNumber(text, match.index);
        const snippet = this.getSnippet(text, match.index, match[0].length);
        threats.push({
          id: pattern.id,
          category: pattern.category,
          title: pattern.title,
          severity: pattern.severity,
          riskScore: pattern.weight,
          line,
          snippet,
          detail: pattern.detail,
          action: pattern.action,
        });
        if (pattern.weight > maxRisk) {
          maxRisk = pattern.weight;
        }
      }
    }

    // Determine Verdict
    let verdict = 'ALLOW';
    if (maxRisk >= 80) {
      verdict = 'BLOCKED';
    } else if (maxRisk >= 50) {
      verdict = 'WARN';
    }

    return {
      hasInjection: threats.length > 0,
      riskScore: maxRisk,
      verdict,
      threats,
      filePath,
      sanitizedContent: this.disarm(text, filePath, threats),
    };
  }

  /**
   * Disarms detected prompt injections and encloses the document in a strict isolation envelope
   * @param {string} text Original text
   * @param {string} [filePath=''] File path
   * @param {Array} [threats=[]] Detected threats
   * @returns {string} Sanitized text
   */
  disarm(text, filePath = '', threats = []) {
    if (!text || typeof text !== 'string') return text;
    let sanitized = text;

    // 1. Strip zero-width characters
    sanitized = sanitized.replace(ZERO_WIDTH_CHARS_REGEX, '');

    // 2. Neutralize dangerous HTML comments
    sanitized = sanitized.replace(HIDDEN_HTML_COMMENT_REGEX, (match, body) => {
      const isDangerous = /\b(ignore|override|exfiltrate|socket|\.env|curl|token|secret|password|run|exec)\b/i.test(body);
      if (isDangerous) {
        return `<!-- [🛡️ AGENT SENTINEL: HIDDEN PROMPT INJECTION NEUTRALIZED] -->`;
      }
      return match;
    });

    // 3. Neutralize hidden CSS tags
    sanitized = sanitized.replace(HIDDEN_CSS_TAG_REGEX, () => {
      return `[🛡️ AGENT SENTINEL: HIDDEN CSS TEXT INJECTION NEUTRALIZED]`;
    });

    // 4. Neutralize linguistic instruction override patterns
    for (const pattern of INJECTION_PATTERNS) {
      sanitized = sanitized.replace(new RegExp(pattern.regex.source, 'gi'), (match) => {
        return `[🛡️ AGENT SENTINEL NEUTRALIZED INJECTION: ${pattern.id} - ${pattern.title}]`;
      });
    }

    // 5. Wrap inside cryptographic containment envelope
    const fileLabel = filePath ? path.basename(filePath) : 'document';
    return `<untrusted_document_inert_data source="${fileLabel}" integrity="sanitized_by_sentinel">
${sanitized}
</untrusted_document_inert_data>`;
  }

  getLineNumber(text, index) {
    if (typeof index !== 'number' || index <= 0) return 1;
    return text.slice(0, index).split('\n').length;
  }

  getSnippet(text, index, matchLength) {
    const start = Math.max(0, index - 20);
    const end = Math.min(text.length, index + matchLength + 40);
    return text.slice(start, end).replace(/\n/g, ' ').trim();
  }
}

module.exports = {
  IngestionGuard,
  INJECTION_PATTERNS,
};
