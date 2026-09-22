// CupidxChat self-hosted moderation engine.
// No OpenAI/Gemini/third-party moderation API is used here.
// This module runs entirely on the backend.

const RISK_RANK = {
  SAFE: 0,
  LOW_RISK: 1,
  MEDIUM_RISK: 2,
  HIGH_RISK: 3,
  CRITICAL: 4,
};

const LEET_MAP = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  '$': 's',
};

const RULES = [
  {
    category: 'THREAT',
    severity: 'CRITICAL',
    patterns: [
      /\b(?:kill|murder|shoot|stab|strangle|bomb|attack)\s+(?:you|u|him|her|them)\b/i,
      /\b(?:i(?:'| a)m|im|i am)\s+(?:going\s+to|gonna)\s+(?:kill|hurt|murder|shoot|stab)\b/i,
      /\b(?:you(?:'|ll| will)\s+die|death\s+threat)\b/i,
    ],
  },
  {
    category: 'SEXUAL_SOLICITATION',
    severity: 'HIGH_RISK',
    patterns: [
      /\b(?:send|show)\s+(?:me\s+)?(?:your\s+)?(?:nudes?|naked\s+pics?|explicit\s+pics?|sex\s+pics?)\b/i,
      /\b(?:sex|hookup|hook\s*up)\s+(?:with|meet)\s+(?:me|u)\b/i,
      /\b(?:onlyfans|cashapp)\b.{0,40}\b(?:sex|nudes?|meet)\b/i,
      /\b(?:come|meet)\s+(?:over|irl)\b.{0,30}\b(?:sex|fuck|hookup)\b/i,
    ],
  },
  {
    category: 'SCAM',
    severity: 'HIGH_RISK',
    patterns: [
      /\b(?:send|pay|transfer)\s+(?:me\s+)?(?:money|cash|crypto|bitcoin|gift\s*card)\b/i,
      /\b(?:double|triple)\s+(?:your\s+)?money\b/i,
      /\bguaranteed\s+(?:profit|return|income)\b/i,
      /\b(?:verify|confirm)\s+your\s+account\b.{0,50}\b(?:link|click|login|password|otp)\b/i,
      /\b(?:otp|password|cvv|upi\s+pin)\b.{0,40}\b(?:send|share|tell|give)\b/i,
    ],
  },
  {
    category: 'MALICIOUS_LINK',
    severity: 'HIGH_RISK',
    patterns: [
      /\b(?:https?:\/\/)?(?:bit\.ly|tinyurl\.com|t\.co|is\.gd|rb\.gy|cutt\.ly|grabify\.link|iplogger\.)\S*/i,
      /\b(?:discord\.gg|t\.me|wa\.me)\/\S+/i,
    ],
  },
  {
    category: 'HATE_ABUSE',
    severity: 'HIGH_RISK',
    patterns: [
      /\b(?:go\s+back|you\s+people)\b.{0,25}\b(?:race|country|religion|caste)\b/i,
      /\b(?:hate|kill)\s+(?:all|every)\s+(?:of\s+)?(?:them|you\s+people)\b/i,
    ],
  },
  {
    category: 'HARASSMENT',
    severity: 'MEDIUM_RISK',
    patterns: [
      /\b(?:idiot|stupid|moron|loser|dumb|shut\s*up)\b.{0,20}\b(?:you|u|ur)\b/i,
      /\b(?:fuck|fck|f\*ck)\s+(?:you|u)\b/i,
    ],
  },
  {
    category: 'SPAM',
    severity: 'MEDIUM_RISK',
    patterns: [
      /(.)\1{5,}/i,
      /(?:free|win|winner|click|claim)\s+(?:now|here|today).{0,50}(?:free|win|offer|prize)/i,
      /\b(?:dm|message)\s+me\b.{0,25}\b(?:everyone|all|100%)\b/i,
    ],
  },
];

function normalizeText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[013457@$]/g, (char) => LEET_MAP[char] || char)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactText(value) {
  return normalizeText(value).replace(/\s+/g, '');
}

function riskFromSeverity(severity, confidence) {
  if (severity === 'CRITICAL') return 'CRITICAL';
  if (severity === 'HIGH_RISK') return confidence >= 0.92 ? 'CRITICAL' : 'HIGH_RISK';
  if (severity === 'MEDIUM_RISK') return 'MEDIUM_RISK';
  return confidence >= 0.25 ? 'LOW_RISK' : 'SAFE';
}

function policyForRisk(risk) {
  if (risk === 'CRITICAL') return 'TERMINATE_MATCH';
  if (risk === 'HIGH_RISK') return 'FLAG_ADMIN_REVIEW';
  if (risk === 'MEDIUM_RISK') return 'INCREASE_MONITORING';
  return 'NONE';
}

function detectBehavior(text, context) {
  const compact = compactText(text);
  const normalized = normalizeText(text);
  const recentCount = Number(context.recentMessageCount || 0);
  const reportCount = Number(context.reportCount || 0);
  const priorHighRiskCount = Number(context.priorHighRiskCount || 0);

  if (recentCount >= 12) {
    return {
      category: 'MESSAGE_FLOOD',
      severity: 'HIGH_RISK',
      confidence: 0.90,
      reason: 'Excessive message frequency detected.',
    };
  }

  if (recentCount >= 7 && normalized.length <= 16) {
    return {
      category: 'SPAM',
      severity: 'MEDIUM_RISK',
      confidence: 0.78,
      reason: 'Repeated short-message behavior detected.',
    };
  }

  if (reportCount >= 6 || priorHighRiskCount >= 5) {
    return {
      category: 'REPEATED_ABUSE',
      severity: 'HIGH_RISK',
      confidence: 0.86,
      reason: 'Repeated reports or high-risk moderation history detected.',
    };
  }

  if (reportCount >= 3 || priorHighRiskCount >= 2) {
    return {
      category: 'BEHAVIORAL_SIGNAL',
      severity: 'MEDIUM_RISK',
      confidence: 0.62,
      reason: 'Previous safety signals increased moderation risk.',
    };
  }

  // Catch URL flooding and excessive repeated tokens locally.
  const words = normalized.split(' ').filter(Boolean);
  const uniqueWords = new Set(words);
  if (words.length >= 12 && uniqueWords.size <= Math.max(3, Math.floor(words.length * 0.25))) {
    return {
      category: 'SPAM',
      severity: 'MEDIUM_RISK',
      confidence: 0.75,
      reason: 'Highly repetitive message content detected.',
    };
  }

  if (compact.length >= 8 && /(.)\1{5,}/i.test(compact)) {
    return {
      category: 'SPAM',
      severity: 'MEDIUM_RISK',
      confidence: 0.74,
      reason: 'Repeated-character spam detected.',
    };
  }

  return null;
}

function analyzeMessage(text, context = {}) {
  const raw = String(text || '').trim();
  if (!raw) {
    return {
      risk: 'SAFE',
      category: 'NONE',
      confidence: 1,
      recommendedAction: 'NONE',
      reason: null,
    };
  }

  const normalized = normalizeText(raw);
  const compact = compactText(raw);

  // Evaluate the original, normalized and compact forms so basic evasion does not bypass rules.
  for (const rule of RULES) {
    if (rule.patterns.some((pattern) => pattern.test(raw) || pattern.test(normalized) || pattern.test(compact))) {
      let confidence = rule.severity === 'CRITICAL' ? 0.99 : rule.severity === 'HIGH_RISK' ? 0.91 : 0.78;
      let risk = riskFromSeverity(rule.severity, confidence);

      // Repeated prior signals can raise a non-critical violation one level.
      if (risk === 'MEDIUM_RISK' && (Number(context.priorHighRiskCount || 0) >= 2 || Number(context.reportCount || 0) >= 3)) {
        risk = 'HIGH_RISK';
        confidence = 0.88;
      }

      return {
        risk,
        category: rule.category,
        confidence,
        recommendedAction: policyForRisk(risk),
        reason: 'Self-hosted moderation rule matched.',
      };
    }
  }

  const behavior = detectBehavior(raw, context);
  if (behavior) {
    const risk = riskFromSeverity(behavior.severity, behavior.confidence);
    return {
      risk,
      category: behavior.category,
      confidence: behavior.confidence,
      recommendedAction: policyForRisk(risk),
      reason: behavior.reason,
    };
  }

  return {
    risk: 'SAFE',
    category: 'NONE',
    confidence: 0.98,
    recommendedAction: 'NONE',
    reason: null,
  };
}

async function recordModerationEvent(prisma, data) {
  try {
    return await prisma.moderationEvent.create({ data });
  } catch (error) {
    console.warn('[MODERATION] Failed to persist event:', error?.message || error);
    return null;
  }
}

module.exports = {
  analyzeMessage,
  recordModerationEvent,
  policyForRisk,
  normalizeText,
};
