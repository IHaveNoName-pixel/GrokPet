import { ChevronIcon } from "../icon-morph/icon-morph";
"use client";

import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Variants } from "motion/react";
import { ChevronDown, Clock3 } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./time-picker.module.css";

export interface TimePickerProps {
  label: string;
  open?: boolean;
  onOpenChange?: (open:boolean)=>void;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  description?: string;
  placeholder?: string;
  minuteStep?: 1 | 5 | 10 | 15 | 30;
  format?: "12h" | "24h";
  disabled?: boolean;
  className?: string;
}

const pad = (value: number) => String(value).padStart(2, "0");
const toMinutes = (value: string) => { const [h = NaN, m = NaN] = value.split(":").map(Number); return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : 0; };
const enter = motionTokens.ease.enter;
const standard = motionTokens.ease.standard;
/** The shown time rolls like a clock face: a later time rises from below, an earlier one drops from above. */
const valueRoll: Variants = {
  enter: (direction: number) => ({ opacity: 0, y: `${direction * 0.35}em`, filter: `blur(${motionTokens.blur.soft}px)` }),
  center: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: motionTokens.duration.standard, ease: enter } },
  exit: (direction: number) => ({ opacity: 0, y: `${direction * -0.3}em`, filter: `blur(${motionTokens.blur.subtle}px)`, transition: { duration: motionTokens.duration.fast, ease: standard } }),
};
/** Reduced motion keeps a short crossfade; the resting state matches valueRoll so server and client markup agree. */
const valueFade: Variants = { enter: { opacity: 0 }, center: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: motionTokens.duration.instant } }, exit: { opacity: 0, transition: { duration: motionTokens.duration.instant } } };

export function TimePicker({ label, value, defaultValue = "09:00", onChange, description, placeholder = "Select a time", minuteStep = 15, format = "12h", disabled = false, className,open:controlled,onOpenChange }: TimePickerProps) {
  const id = useId();
  const labelId = `${id}-label`;
  const valueId = `${id}-value`;
  const rootRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const centerOnOpen = useRef(false);
  const [internal, setInternal] = useState(defaultValue);
  const [internalOpen, setInternalOpen] = useState(false);
  const open=controlled??internalOpen;const setOpen=(v:boolean)=>{setInternalOpen(v);onOpenChange?.(v);};
  const [placement,setPlacement]=useState({left:0,top:0,width:220,maxHeight:250});
  useLayoutEffect(()=>{if(!open)return;const place=()=>{const r=rootRef.current?.querySelector("button")?.getBoundingClientRect();if(!r)return;const below=innerHeight-r.bottom-12,above=r.top-12,h=Math.min(250,Math.max(above,below));setPlacement({left:Math.max(8,Math.min(r.left,innerWidth-Math.max(r.width,200)-8)),top:below>=h?r.bottom+6:Math.max(8,r.top-h-6),width:Math.max(r.width,200),maxHeight:h});};place();window.addEventListener("resize",place);window.addEventListener("scroll",place,true);return()=>{window.removeEventListener("resize",place);window.removeEventListener("scroll",place,true);};},[open]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const selected = value ?? internal;
  const reduce = useReducedMotion();
  const [previous, setPrevious] = useState(selected);
  const [direction, setDirection] = useState(1);
  if (previous !== selected) { setPrevious(selected); setDirection(toMinutes(selected) >= toMinutes(previous) ? 1 : -1); }
  const [windowStart,setWindowStart]=useState(0);
  const windowSize=36;
  const keyboardScroll=useRef(false);
  const options = Array.from({ length: Math.ceil(1440 / minuteStep) }, (_, index) => { const minutes = index * minuteStep; const hour = Math.floor(minutes / 60); const minute = minutes % 60; return `${pad(hour)}:${pad(minute)}`; });
  const visibleStart=Math.max(0,Math.min(options.length-windowSize,windowStart));
  const visibleOptions=options.slice(visibleStart,visibleStart+windowSize);
  const display = (raw: string) => { const minutes = toMinutes(raw); const hour = Math.floor(minutes / 60); const minute = minutes % 60; return format === "24h" ? `${pad(hour)}:${pad(minute)}` : `${hour % 12 || 12}:${pad(minute)} ${hour < 12 ? "AM" : "PM"}`; };
  useEffect(() => { const close = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node) && !(event.target as Element)?.closest?.(`[data-arc-time="${id}"]`)) setOpen(false); }; document.addEventListener("pointerdown", close); return () => document.removeEventListener("pointerdown", close); }, []);
  // Runs before paint so the menu's first frame is already centered on the selected time.
  useLayoutEffect(() => {
    if (!open || activeIndex < 0 || (!centerOnOpen.current && !keyboardScroll.current)) return;
    // Scroll only the menu, never the page: the selected time opens centered, arrow keys then keep the highlight in view.
    const option = optionRefs.current[activeIndex];
    const menu = option?.parentElement;
    if (!option || !menu) return;
    keyboardScroll.current=false;
    const top = option.offsetTop;
    const bottom = top + option.offsetHeight;
    if (centerOnOpen.current) { centerOnOpen.current = false; menu.scrollTop = top - (menu.clientHeight - option.offsetHeight) / 2; }
    else if (top < menu.scrollTop) menu.scrollTop = top;
    else if (bottom > menu.scrollTop + menu.clientHeight) menu.scrollTop = bottom - menu.clientHeight;
  }, [activeIndex, open,windowStart]);
  const choose = (next: string) => { if (value === undefined) setInternal(next); onChange?.(next); setOpen(false); };
  const openMenu = () => {
    const selectedIndex = options.indexOf(selected);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);setWindowStart(Math.max(0,selectedIndex-12));
    centerOnOpen.current = true;
    setOpen(true);
  };
  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Escape") { event.preventDefault(); setOpen(false); return; }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open && activeIndex >= 0) choose(options[activeIndex]!);
      else openMenu();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) { openMenu(); return; }
      const next=(activeIndex + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
      keyboardScroll.current=true;
      if(next<visibleStart||next>=visibleStart+windowSize)setWindowStart(Math.max(0,next-12));
      setActiveIndex(next);
    }
  };
  return <div ref={rootRef} className={[styles.field, className].filter(Boolean).join(" ")}>
    <span id={labelId} className={styles.label}>{label}</span>
    <div className={styles.anchor}>
      <button type="button" className={styles.trigger} disabled={disabled} aria-labelledby={`${labelId} ${valueId}`} aria-haspopup="listbox" aria-expanded={open} aria-controls={`${id}-listbox`} onClick={() => open ? setOpen(false) : openMenu()} onKeyDown={onKeyDown}>
        <Clock3 size={16} aria-hidden="true" />
        <span id={valueId} className={styles.srOnly}>{selected ? display(selected) : placeholder}</span>
        <span className={styles.valueText} aria-hidden="true"><AnimatePresence initial={false} custom={direction}><motion.span key={selected || "placeholder"} className={selected ? styles.value : styles.placeholder} custom={direction} variants={reduce ? valueFade : valueRoll} initial="enter" animate="center" exit="exit">{selected ? display(selected) : placeholder}</motion.span></AnimatePresence></span>
        <ChevronIcon state={!!open} className={styles.chevron} size={16} aria-hidden="true" />
      </button>
      {createPortal(<AnimatePresence initial={false}>{open && <motion.div data-arc-overlay="time" data-arc-time={id} style={{position:"fixed",...placement,right:"auto",bottom:"auto"}} onScroll={event=>setWindowStart(Math.max(0,Math.floor(event.currentTarget.scrollTop/36)-6))} id={`${id}-listbox`} className={styles.menu} role="listbox" aria-label={`${label} options`} 
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: .97 }}
        animate={{ opacity: 1, y: 0, scale: 1, transition: reduce ? { duration: motionTokens.duration.instant } : { ...motionTokens.spring.snappy, opacity: { duration: motionTokens.duration.fast, ease: enter } } }}
        exit={{ opacity: 0, ...(reduce ? {} : { y: -4, scale: .98 }), transition: { duration: motionTokens.duration.instant, ease: standard } }}>
        <div aria-hidden="true" style={{height:visibleStart*36}}/>{visibleOptions.map((option, localIndex) => {const index=visibleStart+localIndex;return <button aria-setsize={options.length} aria-posinset={index+1} ref={node => { optionRefs.current[index] = node; }} id={`${id}-option-${index}`} type="button" role="option" aria-selected={option === selected} data-active={activeIndex === index || undefined} className={styles.option} key={option} onPointerMove={() => { if (activeIndex !== index) setActiveIndex(index); }} onClick={() => choose(option)}>{display(option)}{option === selected && <span className={styles.dot} aria-hidden="true" />}</button>;})}<div aria-hidden="true" style={{height:Math.max(0,options.length-visibleStart-windowSize)*36}}/>
      </motion.div>}</AnimatePresence>,document.body)}
    </div>
    {description && <span className={styles.description}>{description}</span>}
  </div>;
}
