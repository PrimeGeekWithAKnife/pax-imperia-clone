import tipsData from '../loading-tips.json' with { type: 'json' };

export interface LoadingTip {
  text: string;
  category: string;
}

/** All loading tips from every category. */
export const LOADING_TIPS: LoadingTip[] = tipsData as LoadingTip[];

/** All tip text strings, flattened across categories. */
export const ALL_TIP_TEXTS: string[] = LOADING_TIPS.map((t) => t.text);
