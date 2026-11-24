import { useEffect, useMemo, useState } from 'react';
import ChevronLeft from '@untitled-ui/icons-react/build/esm/ChevronLeft';
import ChevronRight from '@untitled-ui/icons-react/build/esm/ChevronRight';
import Check from '@untitled-ui/icons-react/build/esm/Check';
import { COPY } from '../../shared/copy';
import { Segmented, ItemRow, Empty, Media, titleOf } from './parts';
import { weeksOf, dotsFor, DOW, whenOf, byWhen, feedOrder, groupByWeek, monthName, shortDate, dowIndex, kindOf } from '../../lib/plannerView';

/* Plan (Planner v2, part 1 E; was Posts). Calendar, Feed and List at every
 * width; the phone gets the calendar too, its seven columns kept at 44px by
 * letting the grid use the gutter below 400px. A row or a tile is one real
 * control that opens the post page. */

const VIEW_KEY = 'vz_planner_view';
const VIEWS = ['calendar', 'feed', 'list'];
const readView = () => { try { const v = localStorage.getItem(VIEW_KEY); return VIEWS.includes(v) ? v : 'calendar'; } catch { return 'calendar'; } };
const writeView = (v) => { try { localStorage.setItem(VIEW_KEY, v); } catch { /* private mode */ } };
const lineOf = (item) => [shortDate(whenOf(item)), item.time, kindOf(item) === 'ad' ? COPY.planner.kinds.ad : ''].filter(Boolean).join(' · ');

export function MonthBar({ month, onShift }) {
  const P = COPY.planner.plan;
  return (
    <div className="pl-monthbar">
      <button type="button" className="pl-iconbtn" onClick={() => onShift(-1)} aria-label={P.prevMonth}><ChevronLeft width={18} height={18} aria-hidden="true" /></button>
      <h1 className="pl-month">{monthName(month)} {String(month).slice(0, 4)}</h1>
      <button type="button" className="pl-iconbtn" onClick={() => onShift(1)} aria-label={P.nextMonth}><ChevronRight width={18} height={18} aria-hidden="true" /></button>
    </div>
  );
}

function Calendar({ items, month, today, day, onPick, onOpen }) {
  const P = COPY.planner;
  const weeks = useMemo(() => weeksOf(month), [month]);
  const dayItems = items.filter(i => whenOf(i) === day).sort(byWhen);
  return (
    <>
      <div className="pl-cal" role="group" aria-label={`${monthName(month)} ${month.slice(0, 4)}`}>
        <div className="pl-cal-head" aria-hidden="true">{DOW.map(d => <span key={d}>{d.slice(0, 1)}</span>)}</div>
        {weeks.map((w, i) => (
          <div key={i} className="pl-cal-week">
            {w.map((key, j) => {
              if (!key) return <span key={j} className="pl-cal-pad" />;
              const dots = dotsFor(items, key);
              const n = items.filter(it => whenOf(it) === key).length;
              const label = `${DOW[dowIndex(key)]} ${shortDate(key)}${n ? `, ${n} planned` : ''}`;
              return (
                <button key={key} type="button" className={`pl-cal-day${key === day ? ' is-on' : ''}${key === today ? ' is-today' : ''}`} onClick={() => onPick(key)}
                  aria-pressed={key === day} aria-label={label} aria-current={key === today ? 'date' : undefined}>
                  <span className="pl-cal-num" aria-hidden="true">{Number(key.slice(-2))}</span>
                  <span className="pl-dots" aria-hidden="true">{dots.map((t, k) => <span key={k} className={`pl-dot pl-dot--${t}`} />)}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <section className="pl-dayitems" aria-label={shortDate(day)} aria-live="polite">
        <h2 className="pl-h2">{DOW[dowIndex(day)]} {shortDate(day)}</h2>
        {dayItems.length
          ? <div className="pl-rows">{dayItems.map(i => <ItemRow key={i.id} item={i} title={titleOf(i)} line={lineOf(i)} onOpen={onOpen} />)}</div>
          : <p className="pl-muted">{P.plan.nothingOn(shortDate(day))}</p>}
      </section>
    </>
  );
}

function Feed({ items, onOpen }) {
  const P = COPY.planner;
  const list = feedOrder(items);
  if (!list.length) return <Empty {...P.empty.feed} kind="feed" />;
  return (
    <>
      <p className="pl-muted">{P.plan.feedNote}</p>
      <ul className="pl-feed">
        {list.map(i => (
          <li key={i.id} className="pl-feed-tile">
            <Media item={i} crop="4x5f" />
            <span className={`pl-feed-chip${i.status === 'posted' ? ' is-posted' : i.status === 'review' ? ' is-needs' : ''}`} aria-hidden="true">
              {i.status === 'posted' ? <Check width={12} height={12} /> : null}{shortDate(i.date) || P.post.noDate}
            </span>
            <button type="button" className="pl-cover v-stretch" onClick={() => onOpen(i)} aria-label={`${titleOf(i)}, ${shortDate(i.date) || P.post.noDate}${i.status === 'posted' ? `, ${P.plan.feedPosted}` : ''}`} />
          </li>
        ))}
      </ul>
    </>
  );
}

function List({ items, month, onOpen }) {
  const groups = groupByWeek(items, month);
  return groups.map(g => (
    <section key={g.key} className="pl-week-group" aria-label={g.label}>
      <h2 className="pl-h2">{g.label}</h2>
      <div className="pl-rows">{g.items.map(i => <ItemRow key={i.id} item={i} title={titleOf(i)} line={lineOf(i)} onOpen={onOpen} />)}</div>
    </section>
  ));
}

export default function PlanScreen({ items, month, today, day: dayParam, onShift, onOpen }) {
  const P = COPY.planner;
  const [view, setView] = useState(() => (dayParam ? 'calendar' : readView()));
  const firstDay = useMemo(() => (today.slice(0, 7) === month ? today : (items.map(whenOf).filter(k => k.startsWith(month)).sort()[0] || `${month}-01`)), [today, month, items]);
  const [day, setDay] = useState(() => (dayParam && dayParam.startsWith(month) ? dayParam : firstDay));
  useEffect(() => { setDay(d => (d.startsWith(month) ? d : firstDay)); }, [month, firstDay]);
  const pick = (v) => { setView(v); writeView(v); };
  const options = VIEWS.map(id => ({ id, label: P.plan.views[id] }));
  return (
    <>
      <MonthBar month={month} onShift={onShift} />
      <Segmented label={P.plan.title} options={options} value={view} onChange={pick} full />
      {!items.length ? <Empty {...P.empty.planMonth} kind="plan" /> : (
        <>
          {view === 'calendar' && <Calendar items={items} month={month} today={today} day={day} onPick={setDay} onOpen={onOpen} />}
          {view === 'feed' && <Feed items={items} onOpen={onOpen} />}
          {view === 'list' && <List items={items} month={month} onOpen={onOpen} />}
        </>
      )}
    </>
  );
}
