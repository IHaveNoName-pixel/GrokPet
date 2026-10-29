import { clsx } from 'clsx'; import { twMerge } from 'tailwind-merge'; export function cn(...v:any[]){ return twMerge(clsx(v)); }
