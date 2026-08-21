/**
 * Lucide icons — only the glyphs this site uses are bundled.
 * Markup uses `<i data-lucide="name">`; `createIcons` swaps each for an
 * inline SVG and carries the element's attributes (class, aria-hidden) over.
 */

import {
  createIcons,
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Asterisk,
  AtSign,
  BatteryFull,
  Bluetooth,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Droplets,
  Feather,
  Glasses,
  HeartPulse,
  Home,
  Mail,
  Menu,
  MessageCircle,
  Moon,
  Move3d,
  Pause,
  Play,
  Plus,
  Quote,
  Scan,
  ShoppingBag,
  Sparkles,
  Thermometer,
  User,
  Waves,
  Wind,
  X,
} from 'lucide';

export function initIcons(): void {
  createIcons({
    icons: {
      Activity, ArrowDown, ArrowRight, ArrowUp, ArrowUpRight, Asterisk, AtSign,
      BatteryFull, Bluetooth, Check, ChevronLeft, ChevronRight, CircleDot, Droplets,
      Feather, Glasses, HeartPulse, Home, Mail, Menu, MessageCircle, Moon, Move3d,
      Pause, Play, Plus, Quote, Scan, ShoppingBag, Sparkles, Thermometer, User,
      Waves, Wind, X,
    },
    attrs: { 'stroke-width': 1.75 },
  });
}
