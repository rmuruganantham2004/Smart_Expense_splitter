import OpenAI from 'openai';

interface ParsedExpense {
  payer: string;
  amount: number;
  description: string;
  participants: string[];
}

/**
 * Parses a natural language expense string.
 * First tries to use OpenAI if API key is configured, otherwise falls back to a regex parser.
 */
export async function parseExpenseText(text: string, knownMembers: string[] = []): Promise<ParsedExpense> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (apiKey && apiKey.trim() !== '') {
    try {
      const openai = new OpenAI({ apiKey });
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert expense parser. Extract structured details from the natural language text describing a shared expense.
If the text mentions sharing with "everyone", set participants to ["everyone"].
Known group members to help resolve names (optional): ${JSON.stringify(knownMembers)}

Return a strict JSON object with this shape:
{
  "payer": "Name of payer",
  "amount": 1200.00,
  "description": "Pizza dinner",
  "participants": ["Name1", "Name2", "Name3"]
}`
          },
          {
            role: 'user',
            content: text
          }
        ],
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content) as ParsedExpense;
        // Resolve "everyone" if present
        if (parsed.participants.length === 1 && parsed.participants[0].toLowerCase() === 'everyone') {
          parsed.participants = knownMembers.length > 0 ? knownMembers : [parsed.payer];
        }
        return {
          payer: parsed.payer || '',
          amount: typeof parsed.amount === 'number' ? parsed.amount : parseFloat(parsed.amount) || 0,
          description: parsed.description || 'Expense',
          participants: Array.isArray(parsed.participants) ? parsed.participants : [],
        };
      }
    } catch (error) {
      console.error('OpenAI Parsing failed, falling back to regex:', error);
    }
  }

  // Regex fallback parser
  return parseExpenseRegexFallback(text, knownMembers);
}

/**
 * Fallback parser using regex matching:
 * Matches formats:
 * - "[Payer] paid [Amount] for [Description] shared with [Name1], [Name2] and [Name3]"
 * - "[Payer] paid [Amount] for [Description] shared with everyone"
 * - "[Payer] spent [Amount] on [Description]..."
 */
export function parseExpenseRegexFallback(text: string, knownMembers: string[] = []): ParsedExpense {
  const result: ParsedExpense = {
    payer: '',
    amount: 0,
    description: '',
    participants: [],
  };

  const cleanText = text.trim();

  // Try common patterns
  // Pattern 1: {Payer} paid/spent {Amount} for/on {Description} shared/split with {Participants}
  const mainRegex = /([A-Za-z]+)\s+(?:paid|spent)\s+(\d+(?:\.\d+)?)\s+(?:for|on)\s+(.*?)(?:\s+(?:shared|split|with)\s+(?:with\s+)?(.*))?$/i;
  const match = cleanText.match(mainRegex);

  if (match) {
    result.payer = match[1].trim();
    result.amount = parseFloat(match[2]);
    
    let descAndPart = match[3].trim();
    let participantsStr = match[4] ? match[4].trim() : '';

    // If "shared with" was not matched cleanly because it was inside the description, e.g., "pizza shared with Akash"
    if (!participantsStr) {
      const shareIndex = descAndPart.toLowerCase().indexOf('shared with');
      const splitIndex = descAndPart.toLowerCase().indexOf('split with');
      const index = shareIndex !== -1 ? shareIndex : splitIndex;
      if (index !== -1) {
        participantsStr = descAndPart.substring(index + 11).trim();
        descAndPart = descAndPart.substring(0, index).trim();
      }
    }

    result.description = descAndPart.replace(/^(for|on)\s+/i, '').trim();

    // Clean up participants list
    if (participantsStr) {
      // Remove trailing period if any
      if (participantsStr.endsWith('.')) {
        participantsStr = participantsStr.slice(0, -1);
      }

      if (participantsStr.toLowerCase() === 'everyone') {
        result.participants = knownMembers.length > 0 ? [...knownMembers] : [result.payer];
      } else {
        // Split by commas, 'and', '&'
        const parts = participantsStr
          .split(/,|\band\b|&/i)
          .map(p => p.trim())
          .filter(p => p.length > 0);

        result.participants = parts;
      }
    } else {
      // If no participants specified, default to payer only
      result.participants = [result.payer];
    }
  } else {
    // Super basic fallback: look for numbers as amount
    const amountMatch = cleanText.match(/(\d+(?:\.\d+)?)/);
    if (amountMatch) {
      result.amount = parseFloat(amountMatch[1]);
    }
    result.description = cleanText;
    result.participants = knownMembers.length > 0 ? [...knownMembers] : [];
  }

  // Ensure payer is in participants if not empty
  if (result.payer && !result.participants.some(p => p.toLowerCase() === result.payer.toLowerCase())) {
    // Verify if it's already matches a casing
    const exists = result.participants.find(p => p.toLowerCase() === result.payer.toLowerCase());
    if (!exists) {
      result.participants.unshift(result.payer);
    }
  }

  // Clean up any remaining formatting
  result.description = result.description.replace(/^[,\s\.]+/, '').trim();
  // Capitalize payer
  if (result.payer) {
    result.payer = result.payer.charAt(0).toUpperCase() + result.payer.slice(1);
  }

  // Capitalize participants
  result.participants = result.participants.map(p => {
    // If it's a known member, match its case
    const known = knownMembers.find(k => k.toLowerCase() === p.toLowerCase());
    if (known) return known;
    return p.charAt(0).toUpperCase() + p.slice(1);
  });

  return result;
}
