/**
 * LLM helper — Groq API (OpenAI-compatible)
 * Provider: groq.com (free tier, fast inference)
 * Switch provider by changing GROQ_BASE_URL + GROQ_MODEL env vars if needed.
 */

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1/chat/completions';

/** Light model: fast, for simple tasks (tags, impact summary, consensus) */
export const MODEL_FAST = 'llama-3.1-8b-instant';
/** Quality model: for agent personas requiring deep reasoning */
export const MODEL_QUALITY = 'llama-3.3-70b-versatile';

export class LLMError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly isTimeout = false,
    public readonly retryAfterMs = 0,
    public readonly limitKind?: 'tokens_day'|'tokens_minute'|'requests_day'|'requests_minute',
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

export async function callLLM(
  prompt: string,
  options: {
    model?: string;
    maxTokens?: number;
    signal?: AbortSignal;
    timeoutMs?: number;
    systemPrompt?: string;
    temperature?: number;
    responseFormat?: Record<string, unknown>;
    reasoningEffort?: 'low' | 'medium' | 'high';
    onUsage?: (usage: {promptTokens:number;completionTokens:number;totalTokens:number}) => void;
  } = {},
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new LLMError('GROQ_API_KEY가 설정되지 않았습니다', 500);

  const {
    model = MODEL_FAST,
    maxTokens = 1200,
    timeoutMs = 20000,
    systemPrompt,
    temperature,
  } = options;

  // Use provided signal or create our own timeout
  let controller: AbortController | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let signal = options.signal;

  if (!signal) {
    controller = new AbortController();
    timer = setTimeout(() => controller!.abort(), timeoutMs);
    signal = controller.signal;
  }

  const messages: Array<{ role: string; content: string }> = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  try {
    const res = await fetch(GROQ_BASE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        ...(options.reasoningEffort ? { reasoning_effort: options.reasoningEffort } : {}),
        messages,
        ...(options.responseFormat ? { response_format: options.responseFormat } : {}),
        ...(temperature !== undefined ? { temperature } : {}),
      }),
      signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const retryHeader = res.headers.get('retry-after');
      const retryAfterMs = retryHeader ? (/^\d+(\.\d+)?$/.test(retryHeader) ? Number(retryHeader)*1000 : Math.max(0,Date.parse(retryHeader)-Date.now())) : 0;
      const limitKind=/tokens per day|\bTPD\b/i.test(body)?'tokens_day':/tokens per minute|\bTPM\b/i.test(body)?'tokens_minute':/requests per day|\bRPD\b/i.test(body)?'requests_day':/requests per minute|\bRPM\b/i.test(body)?'requests_minute':undefined;
      throw new LLMError(`Groq API 오류 (${res.status}): ${body.slice(0, 200)}`, res.status, false, Number.isFinite(retryAfterMs) ? retryAfterMs : 0, limitKind);
    }

    const data = await res.json() as { choices: Array<{ message: { content: string } }>; usage?: {prompt_tokens:number;completion_tokens:number;total_tokens:number} };
    if(data.usage) options.onUsage?.({promptTokens:data.usage.prompt_tokens,completionTokens:data.usage.completion_tokens,totalTokens:data.usage.total_tokens});
    const text: string = data?.choices?.[0]?.message?.content?.trim() ?? '';
    if (!text) throw new LLMError('빈 응답');
    return text;
  } catch (err: unknown) {
    if (err instanceof LLMError) throw err;
    if ((err as Error).name === 'AbortError' || (err as Error).message?.includes('aborted')) {
      throw new LLMError('LLM 응답 시간 초과', 504, true);
    }
    throw new LLMError((err as Error).message ?? 'LLM 호출 실패');
  } finally {
    if (timer) clearTimeout(timer);
  }
}
