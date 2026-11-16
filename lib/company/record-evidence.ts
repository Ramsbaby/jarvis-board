/** An API quota/error response is a retained failure record, never a decision. */
export function isGenerationError(content:string):boolean {
 return /^(?:you['’]ve hit your limit|you have hit your limit|rate_limit_error\b|(?:api )?error:?\s*429\b|(?:요청|토큰|사용량) 한도(?:에|를| 초과))/i.test(content.trim());
}
