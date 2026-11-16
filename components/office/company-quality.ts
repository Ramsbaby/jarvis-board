export type CompanyQuality = 'balanced' | 'detailed';

export const COMPANY_QUALITY_KEY = 'jarvis-board:company-quality';
type QualityStorage = Pick<Storage, 'getItem' | 'setItem'>;
const browserStorage = (): QualityStorage => window.localStorage;

export function readCompanyQuality(storage = browserStorage): CompanyQuality {
  try {
    return storage().getItem(COMPANY_QUALITY_KEY) === 'detailed' ? 'detailed' : 'balanced';
  } catch {
    return 'balanced';
  }
}

export function saveCompanyQuality(quality: CompanyQuality, storage = browserStorage): void {
  try {
    storage().setItem(COMPANY_QUALITY_KEY, quality);
  } catch {
    // Storage is optional; the current session can still change quality.
  }
}
