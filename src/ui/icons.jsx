/* Icon name strings from src/shared/semantics.js resolved to the Untitled UI
 * components already used by the admin. Any component that accepts an
 * `icon` prop takes either a name from this map or a React component. */
import Phone from '@untitled-ui/icons-react/build/esm/Phone';
import PhoneIncoming01 from '@untitled-ui/icons-react/build/esm/PhoneIncoming01';
import Voicemail from '@untitled-ui/icons-react/build/esm/Voicemail';
import Check from '@untitled-ui/icons-react/build/esm/Check';
import PhoneHangUp from '@untitled-ui/icons-react/build/esm/PhoneHangUp';
import Zap from '@untitled-ui/icons-react/build/esm/Zap';
import Sun from '@untitled-ui/icons-react/build/esm/Sun';
import Snowflake01 from '@untitled-ui/icons-react/build/esm/Snowflake01';
import Users01 from '@untitled-ui/icons-react/build/esm/Users01';
import CalendarCheck01 from '@untitled-ui/icons-react/build/esm/CalendarCheck01';
import Trophy01 from '@untitled-ui/icons-react/build/esm/Trophy01';
import Briefcase01 from '@untitled-ui/icons-react/build/esm/Briefcase01';
import XClose from '@untitled-ui/icons-react/build/esm/XClose';
import Bell01 from '@untitled-ui/icons-react/build/esm/Bell01';
import Mail01 from '@untitled-ui/icons-react/build/esm/Mail01';
import MessageCircle01 from '@untitled-ui/icons-react/build/esm/MessageCircle01';
import CurrencyDollar from '@untitled-ui/icons-react/build/esm/CurrencyDollar';
import Package from '@untitled-ui/icons-react/build/esm/Package';
import Calendar from '@untitled-ui/icons-react/build/esm/Calendar';
import User01 from '@untitled-ui/icons-react/build/esm/User01';
import LayoutAlt01 from '@untitled-ui/icons-react/build/esm/LayoutAlt01';
import PhoneCall01 from '@untitled-ui/icons-react/build/esm/PhoneCall01';
import Image01 from '@untitled-ui/icons-react/build/esm/Image01';
import Star01 from '@untitled-ui/icons-react/build/esm/Star01';
import Palette from '@untitled-ui/icons-react/build/esm/Palette';
import Trash01 from '@untitled-ui/icons-react/build/esm/Trash01';
import Settings01 from '@untitled-ui/icons-react/build/esm/Settings01';
import Inbox01 from '@untitled-ui/icons-react/build/esm/Inbox01';
import SearchMd from '@untitled-ui/icons-react/build/esm/SearchMd';
import Plus from '@untitled-ui/icons-react/build/esm/Plus';
import LogOut01 from '@untitled-ui/icons-react/build/esm/LogOut01';
import Edit02 from '@untitled-ui/icons-react/build/esm/Edit02';
import ArrowRight from '@untitled-ui/icons-react/build/esm/ArrowRight';

export const ICONS = {
  Phone, PhoneIncoming01, Voicemail, Check, PhoneHangUp, Zap, Sun, Snowflake01, Users01,
  CalendarCheck01, Trophy01, Briefcase01, XClose, Bell01, Mail01, MessageCircle01,
  CurrencyDollar, Package, Calendar, User01,
  /* shell + nav */
  LayoutAlt01, PhoneCall01, Image01, Star01, Palette, Trash01, Settings01, Inbox01, SearchMd, Plus, LogOut01, Edit02, ArrowRight,
};

/** Resolve an icon prop: a semantics name string, a component, or nothing. */
export function iconFor(icon) {
  if (!icon) return null;
  if (typeof icon === 'string') return ICONS[icon] || null;
  return icon;
}

/** Render helper: <Icon icon="Zap" size={14} /> or size="var(--v-icon-md)".
 *  SVG width/height attributes cannot hold a CSS var, so token sizes go on
 *  the style (which wins over the attributes) with a numeric attribute fallback. */
const TOKEN_PX = { 'var(--v-icon-sm)': 14, 'var(--v-icon-md)': 18, 'var(--v-icon-lg)': 24 };
export function Icon({ icon, size = 'var(--v-icon-sm)', className, style, ...rest }) {
  const Cmp = iconFor(icon);
  if (!Cmp) return null;
  const px = typeof size === 'number' ? size : TOKEN_PX[size] || 16;
  const css = typeof size === 'number' ? style : { width: size, height: size, ...style };
  return <Cmp width={px} height={px} className={className} style={css} aria-hidden="true" {...rest} />;
}
