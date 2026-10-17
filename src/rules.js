/**
 * The deterministic core of Controfirma.
 *
 * No language model touches this file. Given the same transcript it returns the
 * same score, the same fired rules and the same cited spans, every time. That is
 * the whole point: the model is only ever allowed to explain what this file found.
 *
 * Patterns are drawn from the social-engineering markers banks and police publish
 * about impersonation fraud (CEO fraud, false-lawyer fraud, bank-impersonation,
 * supplier IBAN redirection) and cover Italian and English.
 */

/**
 * A single rule.
 *   id       stable identifier, used by the UI and the explanation layer
 * 	 label    human labels, shown to the operator
 *   weight   points added when the rule fires at least once
 *   patterns regexes; every match is recorded as citable evidence
 *   note     why this marker matters, shown in the operator panel
 */
export const RULES = [
  {
    id: 'CREDENTIAL_REQUEST',
    label: { en: 'Asks for a code or password', it: 'Richiede un codice o una password' },
    weight: 30,
    note: 'No bank, lawyer or colleague ever needs your one-time code. A request for one is fraud on its own.',
    patterns: [
      /\b(?:one[- ]?time|otp|secur(?:e|ity)|verification|authorisation|authorization)[- ]?(?:code|password|pin|token)\b/giu,
      /\bcodice\s+(?:otp|usa\s+e\s+getta|di\s+(?:sicurezza|verifica|conferma|autorizzazione|accesso))\b/giu,
      /\b(?:read|give|tell|send|confirm|dictate)\s+me\s+(?:the|that|your)\s+(?:code|otp|pin|password|token)\b/giu,
      /\b(?:mi\s+)?(?:legga|dica|detti|passi|invii|confermi)\s+(?:il|quel|questo)\s+(?:codice|pin|token|otp)\b/giu,
      /\b(?:your|la\s+sua)\s+(?:password|credenziali|credentials)\b/giu,
      /\bsms\s+(?:code|con\s+il\s+codice)\b/giu,
    ],
  },

  {
    id: 'VERIFICATION_REFUSAL',
    label: { en: 'Blocks you from verifying', it: 'Impedisce la verifica' },
    weight: 28,
    note: 'Legitimate callers are happy for you to hang up and ring the official number. Fraudsters cannot allow it.',
    patterns: [
      /\b(?:do\s*n[o']?t|don't|no\s+need\s+to|cannot|can't)\s+(?:call|ring|phone)\s+(?:me\s+)?back\b/giu,
      /\b(?:non|niente)\s+(?:mi\s+)?(?:richiami|richiamare|serve\s+richiamare)\b/giu,
      /\b(?:stay|remain|resti|rimanga)\s+(?:on\s+the\s+line|in\s+linea)\b.{0,60}\b(?:do\s*n[o']?t|don't|non)\b/giu,
      /\b(?:no|non\s+c'è|there\s+is\s+no)\s+(?:time|tempo)\s+(?:to|per)\s+(?:verify|check|verificare|controllare)\b/giu,
      /\b(?:use|chiami|usi)\s+(?:this|questo)\s+(?:number|numero)\s+(?:only|instead|soltanto|invece)\b/giu,
    ],
  },

  {
    id: 'PROCESS_BYPASS',
    label: { en: 'Asks to skip the normal procedure', it: 'Chiede di saltare la procedura' },
    weight: 25,
    note: 'Payment controls exist precisely so that no single phone call can move money. Asking to go around them is the attack.',
    patterns: [
      /\b(?:skip|bypass|go\s+around|work\s+around|without)\s+(?:the\s+)?(?:usual\s+)?(?:approval|authorisation|authorization|procedure|process|sign[- ]?off|double[- ]?check|four[- ]eyes)\b/giu,
      // Softly phrased bypasses. An attacker rarely says "bypass"; they say
      // "so we don't have to go through the usual chain".
      /\b(?:do\s*n[o']?t|don't|doesn[o']?t|avoid|rather\s+not|no\s+need\s+to)\s+(?:have\s+to\s+)?(?:go|going)\s+through\s+(?:the\s+)?(?:whole\s+|full\s+|usual\s+|normal\s+|entire\s+)?(?:approval|authorisation|authorization|process|procedure|chain|system|channels?)\b/giu,
      /\bprocess\s+(?:it|this|that)\s+manually\b/giu,
      /\b(?:just\s+)?push\s+(?:it|this|that)\s+through\b/giu,
      /\b(?:just\s+)?get\s+(?:this|it)\s+done\s+(?:for\s+me|now|today)\b/giu,
      /\b(?:i|I)\s*(?:'ll|’ll|\s+will)\s+(?:handle|sort|deal\s+with|take\s+care\s+of)\s+(?:the\s+)?(?:paperwork|admin|forms?|approval|sign[- ]?off|rest)\b/giu,
      // Pay now, document later. The paper trail is promised, never delivered.
      /\b(?:just\s+)?process\s+(?:it|this|the\s+payment)\s+(?:now|first|today)\b/giu,
      /\b(?:i|I)\s*(?:'ll|’ll|\s+will)\s+send\s+(?:you\s+|over\s+)?the\s+(?:confirmation|paperwork|invoice|documentation|formal\s+\w+|details)\s+(?:right\s+)?(?:after|afterwards|later|once)\b/giu,
      /\b(?:le\s+)?(?:mando|invio|manderò)\s+(?:poi|dopo|successivamente)\s+(?:la\s+|il\s+|l['’])?(?:conferma|documentazione|fattura|ordine)\b/giu,
      /\bsave\s+you\s+the\s+(?:paperwork|hassle|trouble|admin)\b/giu,
      /\b(?:faccio|sistemo|penso\s+io\s+a)\s+(?:io\s+)?(?:la\s+)?(?:pratica|burocrazia|documentazione|carte)\b/giu,
      /\b(?:salt(?:i|are)|bypassare|aggirare|senza)\s+(?:la\s+|il\s+)?(?:solita\s+)?(?:procedura|approvazione|autorizzazione|firma|doppia\s+firma|controllo)\b/giu,
      /\b(?:no\s+need|not\s+necessary|non\s+serve|non\s+è\s+necessario)\s+(?:for|to|di|la)?\s*(?:the\s+)?(?:second|another|altra|seconda)\s+(?:signature|approval|firma|approvazione)\b/giu,
      /\b(?:i|I)\s+(?:will|'ll)\s+authorise\s+it\s+(?:myself|later)\b/giu,
      /\b(?:autorizzo|firmo)\s+(?:io|poi)\b/giu,
      /\bdirect(?:ly)?\s+(?:to|in)\s+(?:the\s+)?(?:payment|bonifico)\b.{0,40}\bwithout\b/giu,
    ],
  },

  {
    id: 'SECRECY',
    label: { en: 'Demands secrecy', it: 'Impone riservatezza' },
    weight: 25,
    note: 'Secrecy is how the attacker keeps a second pair of eyes off the payment. Real urgent business survives being mentioned to a colleague.',
    patterns: [
      /\b(?:do\s*n[o']?t|don't|must\s+not|cannot)\s+(?:tell|inform|mention|discuss|involve|loop\s+in|speak\s+to|talk\s+to)\b/giu,
      /\b(?:non|niente)\s+(?:ne\s+)?(?:parli|dica|dire|parlare|informi|coinvolga|coinvolgere)\b/giu,
      /\b(?:keep|hold)\s+(?:this|it)\s+(?:strictly\s+)?(?:between\s+us|confidential|quiet|secret)\b/giu,
      /\b(?:resti|rimanga|tenga)\s+(?:tra\s+noi|riservato|confidenziale|segreto)\b/giu,
      // The noun form is how it is actually said: "per mantenere la massima riservatezza".
      /\b(?:massima\s+|assoluta\s+)?riservatezza\b/giu,
      /\b(?:in\s+via\s+)(?:riservata|confidenziale)\b/giu,
      /\b(?:strict(?:est)?|complete|absolute)\s+(?:confidentiality|discretion)\b/giu,
      /\b(?:without|senza)\s+(?:informing|telling|informare|avvisare|dirlo\s+a)\b/giu,
      /\b(?:not|non)\s+(?:even|nemmeno|neanche)\s+(?:the|il|la|ai|alla)\s*(?:cfo|ceo|board|compliance|legal|team|consiglio|direzione)\b/giu,
    ],
  },

  {
    id: 'NEW_BENEFICIARY',
    label: { en: 'New or changed bank details', it: 'Coordinate bancarie nuove o modificate' },
    weight: 22,
    note: 'Redirecting a payment to fresh account details is the single most common way the money actually leaves.',
    patterns: [
      /\b(?:new|different|updated|changed|alternative)\s+(?:iban|account|bank\s+details|beneficiary|coordinates)\b/giu,
      /\b(?:nuovo|nuove|diverso|diverse|aggiornato|aggiornate|modificato|modificate)\s+(?:iban|conto|coordinate|beneficiario)\b/giu,
      /\b(?:iban|account)\s+(?:has\s+)?(?:changed|is\s+different)\b/giu,
      /\b(?:l')?iban\s+(?:è\s+)?(?:cambiato|diverso|nuovo)\b/giu,
      /\b(?:pay|send|transfer|versi|invii|bonifichi)\s+(?:it\s+)?(?:to|su|a)\s+(?:this|questo|another|un\s+altro)\s+(?:account|iban|conto)\b/giu,
      /\bIT\s?\d{2}[\s]?[A-Z][\s]?\d{3}/gu,
    ],
  },

  {
    id: 'CONFIDENTIAL_PRETEXT',
    label: { en: 'Secret deal or investigation pretext', it: 'Pretesto di operazione riservata' },
    weight: 20,
    note: 'A confidential acquisition or a secret investigation is the standard cover story for false-lawyer fraud. It explains the secrecy and the hurry at once.',
    patterns: [
      /\b(?:confidential|secret|undisclosed)\s+(?:acquisition|transaction|operation|deal|merger|investigation|audit)\b/giu,
      // Words often sit between: "l'operazione di acquisizione in corso, quella riservata".
      /\b(?:operazione|acquisizione|transazione|indagine|verifica)\b[^.?!]{0,34}\b(?:riservat[ao]|confidenziale|segret[ao])\b/giu,
      /\b(?:under|sotto)\s+(?:nda|segreto|embargo)\b/giu,
      /\b(?:regulator|consob|bankitalia|banca\s+d'italia|guardia\s+di\s+finanza)\b.{0,50}\b(?:aware|informed|non\s+sa|informata)\b/giu,
      /\b(?:ongoing|in\s+corso)\s+(?:investigation|indagine)\b/giu,
    ],
  },

  {
    id: 'THREAT',
    label: { en: 'Threatens a consequence', it: 'Minaccia una conseguenza' },
    weight: 15,
    note: 'Fear shortens thinking. Blocked accounts, lost deals and legal trouble are manufactured to stop you checking.',
    patterns: [
      // Allow words between the noun and the consequence: "make sure the account
      // doesn't get suspended" is the same threat as "your account will be blocked".
      /\b(?:account|card|service|conto|carta|servizio)\b[^.?!]{0,45}\b(?:blocked|suspended|frozen|cut\s+off|bloccat[oa]|sospes[oa]|disattivat[oa])\b/giu,
      /\b(?:legal\s+action|denuncia|azione\s+legale|conseguenze\s+legali|sanction|sanzione)\b/giu,
      /\b(?:you\s+will\s+be|sarà|sarai)\s+(?:held\s+)?(?:responsible|liable|responsabile)\b/giu,
      /\b(?:lose|perdere|perdiamo|we\s+lose)\s+(?:the\s+)?(?:deal|contract|operazione|contratto|cliente)\b/giu,
      /\b(?:your\s+job|il\s+suo\s+posto|licenziament)/giu,
    ],
  },

  {
    id: 'URGENCY',
    label: { en: 'Extreme time pressure', it: 'Forte pressione temporale' },
    weight: 12,
    note: 'Urgency alone is ordinary business. It only becomes a signal when it arrives with secrecy or a bypass request.',
    patterns: [
      /\b(?:urgent(?:ly)?|immediately|right\s+now|straight\s+away|asap)\b/giu,
      /\b(?:urgent(?:e|issimo|emente)?|urgenza|subito|immediatamente|adesso|al\s+più\s+presto|in\s+giornata)\b/giu,
      /\b(?:in|within|entro|before|by|prima\s+d(?:i|el|ella|ell['’]))\s+(?:the\s+next\s+)?(?:\d+\s*(?:minutes?|minuti|hours?|ore)|an?\s+hour|un'?\s*ora|mezz'?ora|today|oggi|noon|mezzogiorno|closing|chiusura|close\s+of\s+(?:business|play)|the\s+weekend|end\s+of\s+(?:day|the\s+day)|fine\s+giornata)\b/giu,
      /\b(?:deadline|scadenza)\s+(?:is\s+)?(?:today|oggi|in\s+\d+)/giu,
      /\b(?:no|non\s+c'è)\s+(?:time|tempo)\b/giu,
      /\b(?:in\s+a\s+)?(?:bit\s+of\s+a\s+)?(?:rush|hurry)\b/giu,
      /\b(?:ho|abbiamo)\s+(?:molta\s+)?fretta\b/giu,
      /\b(?:needs?|has|have)\s+to\s+(?:clear|go\s+out|be\s+(?:done|paid|sent|made|processed))\s+(?:today|now|before|by|in)\b/giu,
    ],
  },

  {
    id: 'AUTHORITY_CLAIM',
    label: { en: 'Claims senior or official authority', it: 'Dichiara autorità o ruolo ufficiale' },
    weight: 10,
    note: 'Impersonation needs a borrowed identity. Common in fraud, but also in entirely genuine calls, so it carries little weight alone.',
    patterns: [
      /\b(?:this\s+is|i\s+am|i'm|sono|parla)\s+(?:the\s+|your\s+|il\s+|la\s+|il\s+suo\s+)?(?:ceo|cfo|coo|chairman|president|managing\s+director|finance\s+director|director|manager|head\s+of\s+[a-z]+|boss|owner|amministratore\s+delegato|direttore\s+generale|direttore|presidente|titolare|responsabile)\b/giu,
      /\b(?:i\s+am|this\s+is|sono|parla)\s+(?:your|the|il|l')\s*(?:lawyer|solicitor|counsel|avvocato|notaio|notary)\b/giu,
      /\b(?:calling|chiamo|parlo)\s+(?:from|da|a\s+nome\s+di)\s+(?:the\s+)?(?:bank|fraud\s+team|security\s+team|banca|ufficio\s+antifrode|polizia|carabinieri|guardia\s+di\s+finanza)\b/giu,
      /\b(?:on\s+behalf\s+of|per\s+conto\s+di)\s+(?:the\s+)?(?:ceo|chairman|board|amministratore|presidente)\b/giu,
      /\b(?:studio\s+legale|law\s+firm)\b/giu,
    ],
  },

  {
    id: 'CHANNEL_ANOMALY',
    label: { en: 'Unusual channel for money', it: 'Canale insolito per il denaro' },
    weight: 12,
    note: 'A payment instruction that arrives by WhatsApp or from a personal mobile has skipped every system that would have logged it.',
    patterns: [
      /\b(?:whatsapp|telegram|signal|sms|text\s+message|messaggio)\b/giu,
      /\b(?:personal|private|personale|privato)\s+(?:mobile|phone|number|cellulare|numero)\b/giu,
      /\b(?:new|different|nuovo|altro)\s+(?:number|numero)\b/giu,
      /\b(?:my|il\s+mio)\s+(?:other|altro)\s+(?:phone|telefono|numero)\b/giu,
      // Bank details dictated aloud leave no record anyone can check later.
      /\b(?:give|read|dictate|pass)\s+(?:you\s+)?(?:the\s+)?(?:new\s+)?(?:iban|account\s+(?:number|details)|bank\s+details)\s+(?:to\s+you\s+)?over\s+the\s+phone\b/giu,
      /\b(?:le\s+)?(?:detto|dettare)\s+(?:io\s+)?(?:l['’])?(?:iban|le\s+coordinate|i\s+dati)\b/giu,
      /\b(?:only\s+)?(?:verbally|a\s+voce|solo\s+verbalmente)\b/giu,
    ],
  },
];

/**
 * Combinations carry the real signal. A hurried CFO fires URGENCY and nothing
 * else; an attacker needs urgency AND one of the mechanisms that removes
 * oversight. These bonuses are what keep false alarms off genuine calls.
 */
export const COMBINATIONS = [
  {
    ids: ['SECRECY', 'NEW_BENEFICIARY'],
    bonus: 20,
    note: 'Fresh bank details that nobody else may know about. This pairing has almost no innocent explanation.',
  },
  {
    ids: ['URGENCY', 'PROCESS_BYPASS'],
    bonus: 18,
    note: 'Hurry used as the reason to drop the payment controls.',
  },
  {
    ids: ['AUTHORITY_CLAIM', 'CREDENTIAL_REQUEST'],
    bonus: 25,
    note: 'Someone claiming authority while asking for a code. This is bank-impersonation fraud.',
  },
  {
    ids: ['CONFIDENTIAL_PRETEXT', 'SECRECY'],
    bonus: 15,
    note: 'A secret deal used to justify keeping colleagues out. The false-lawyer pattern.',
  },
  {
    ids: ['VERIFICATION_REFUSAL', 'URGENCY'],
    bonus: 15,
    note: 'No time to check, and no way to call back.',
  },
  {
    ids: ['AUTHORITY_CLAIM', 'CHANNEL_ANOMALY'],
    bonus: 12,
    note: 'A senior instruction arriving on a channel the company does not use for payments.',
  },
];

/** Score bands. Deliberately conservative: nothing here blocks a payment by itself. */
export const BANDS = [
  { min: 65, level: 'HOLD', action: 'Hold the payment. Call the person back on a number you already had, and get a second signature.' },
  { min: 35, level: 'REVIEW', action: 'Do not complete this alone. Verify on a known number before any money moves.' },
  { min: 0, level: 'LOW', action: 'No impersonation markers worth stopping for. Normal procedure applies.' },
];

/**
 * Score a transcript.
 *
 * @param {{speaker: string, text: string}[]} lines
 * @returns a deterministic finding: fired rules with every matched span, the
 *          combinations that applied, the total and the band.
 */
export function scoreCall(lines) {
  const fired = new Map();

  lines.forEach((line, lineIndex) => {
    // Only the other party's words are evidence. What our own staff says is not
    // held against them.
    if (line.speaker !== 'caller') return;

    for (const rule of RULES) {
      for (const pattern of rule.patterns) {
        for (const match of line.text.matchAll(pattern)) {
          const entry = fired.get(rule.id) ?? {
            id: rule.id,
            label: rule.label,
            weight: rule.weight,
            note: rule.note,
            evidence: [],
          };
          // Store the span so an explanation can be checked against it later.
          entry.evidence.push({
            lineIndex,
            quote: match[0].trim(),
            start: match.index,
            end: match.index + match[0].length,
            fullLine: line.text,
          });
          fired.set(rule.id, entry);
        }
      }
    }
  });

  const firedRules = [...fired.values()];
  const firedIds = new Set(fired.keys());

  const combinations = COMBINATIONS.filter((c) => c.ids.every((id) => firedIds.has(id)));

  const ruleScore = firedRules.reduce((sum, r) => sum + r.weight, 0);
  const comboScore = combinations.reduce((sum, c) => sum + c.bonus, 0);
  const total = ruleScore + comboScore;

  const band = BANDS.find((b) => total >= b.min);

  return {
    total,
    ruleScore,
    comboScore,
    level: band.level,
    action: band.action,
    firedRules: firedRules.sort((a, b) => b.weight - a.weight),
    combinations,
    // Every quote the explanation layer is allowed to use. Anything outside this
    // set is a fabrication and gets rejected.
    citableQuotes: firedRules.flatMap((r) => r.evidence.map((e) => e.quote)),
  };
}

/**
 * Score a call line by line, the way it arrives during a real conversation, so
 * the operator sees the risk climb as the caller talks.
 */
export function scoreProgressive(lines) {
  return lines.map((_, i) => ({
    upToLine: i,
    ...scoreCall(lines.slice(0, i + 1)),
  }));
}
