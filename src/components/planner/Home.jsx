import Check from '@untitled-ui/icons-react/build/esm/Check';
import ChevronRight from '@untitled-ui/icons-react/build/esm/ChevronRight';
import { COPY } from '../../shared/copy';
import { Media, Empty, titleOf, platformNames } from './parts';
import { reviewQueue, postToday, weekDots, monthProgress, liveAd, adSentence, monthName, shortDate } from '../../lib/plannerView';

/* Home (Planner v2, part 1 C). In this order: the greeting, one line in
 * Rob's voice about the month, Needs you (or all caught up), Post today,
 * This week, the month so far, Your ad and From Rob. A block with nothing
 * to say does not render. */
const DOT_ORDER = ['needs', 'post', 'ad', 'posted'];

export default function HomeScreen({ data, items, month, today, onReview, onOpen, onDay, onTab }) {
  const C = COPY.planner;
  const H = C.home;
  const client = data.client || {};
  const queue = reviewQueue(items);
  const todays = postToday(items, today);
  const week = weekDots(items, today);
  const prog = monthProgress(items, client.postsPerMonth);
  const ad = liveAd(items);
  const adLine = ad ? adSentence(ad.ad) : '';
  const name = monthName(month);
  const anything = items.length > 0;
  const weekHasAny = week.some(d => d.dots.length);

  return (
    <>
      <div className="pl-hello">
        <h1 className="pl-h1">{H.hey(client.firstName)}</h1>
        <p className="pl-lead">{H.lead(prog, name, queue.length)}</p>
      </div>

      {queue.length ? (
        <section className="pl-card pl-card--raised pl-needs" aria-labelledby="pl-needs-h">
          <div className="pl-card-head">
            <h2 className="pl-card-title" id="pl-needs-h">{H.needsTitle}</h2>
            <span className="pl-pill pl-pill--won">{H.toReview(queue.length)}</span>
          </div>
          <p className="pl-needs-line">{H.needsLine(queue.length)}</p>
          <div className="pl-needs-thumbs" aria-hidden="true">
            {queue.slice(0, 3).map(i => <span key={i.id} className="pl-needs-thumb"><Media item={i} crop="1x1" /></span>)}
          </div>
          <button type="button" className="pl-btn pl-btn--lg pl-btn--full pl-review-now" onClick={onReview}>{queue.length === 1 ? H.reviewOne : H.reviewNow}</button>
        </section>
      ) : (
        <p className="pl-caught" role="status"><span className="pl-caught-icon"><Check width={16} height={16} aria-hidden="true" /></span>{H.caughtUp}</p>
      )}

      {!anything && <Empty {...C.empty.home} kind="home" />}

      {todays.map(item => (
        <section key={item.id} className="pl-card pl-today" aria-label={H.postToday}>
          <span className="pl-today-thumb"><Media item={item} crop="1x1" /></span>
          <span className="pl-today-main">
            <span className="pl-h2">{H.postToday}</span>
            <span className="pl-today-title">{titleOf(item)}</span>
            <span className="pl-row-line">{[item.time, platformNames(item).join(', ')].filter(Boolean).join(' · ')}</span>
          </span>
          <span className="pl-pill pl-pill--won pl-today-pill">{H.postIt}</span>
          <button type="button" className="pl-cover v-stretch" onClick={() => onOpen(item)} aria-label={`${H.postIt}: ${titleOf(item)}`}>{H.postIt}</button>
        </section>
      ))}

      {anything && (
        <section className="pl-card pl-weekcard" aria-labelledby="pl-week-h">
          <h2 className="pl-h2" id="pl-week-h">{H.thisWeek}</h2>
          <div className="pl-week">
            {week.map(d => {
              const list = DOT_ORDER.filter(t => d.dots.includes(t)).map(t => `${d.dots.filter(x => x === t).length} ${H.dots[t]}`).join(', ');
              return (
                <button key={d.key} type="button" className={`pl-day${d.isToday ? ' is-today' : ''}`} onClick={() => onDay(d.key)}
                  aria-label={H.dayLabel(d.dow, d.day, list)} aria-current={d.isToday ? 'date' : undefined}>
                  <span className="pl-day-dow" aria-hidden="true">{d.dow.slice(0, 1)}</span>
                  <span className="pl-day-num" aria-hidden="true">{d.day}</span>
                  <span className="pl-dots" aria-hidden="true">{d.dots.map((t, i) => <span key={i} className={`pl-dot pl-dot--${t}`} />)}</span>
                </button>
              );
            })}
          </div>
          {!weekHasAny && <p className="pl-muted">{C.plan.nothingOn(`${shortDate(week[0].key)} to ${shortDate(week[6].key)}`)}</p>}
        </section>
      )}

      {anything && (
        <section className="pl-card" aria-labelledby="pl-month-h">
          <div className="pl-card-head">
            <h2 className="pl-h2" id="pl-month-h">{H.soFar(name)}</h2>
            <button type="button" className="pl-btn pl-btn--ghost pl-btn--sm" onClick={() => onTab('plan')}>{C.tabs.plan}<ChevronRight width={16} height={16} aria-hidden="true" /></button>
          </div>
          <p className="pl-stat"><strong>{H.ready(prog.ready, prog.of)}</strong><span className="pl-muted">{H.posted(prog.posted)}</span></p>
          <span className="pl-bar" role="progressbar" aria-label={H.ready(prog.ready, prog.of)} aria-valuemin={0} aria-valuemax={prog.of} aria-valuenow={Math.min(prog.ready, prog.of)}><span className="pl-bar-fill" style={{ width: `${prog.pct}%` }} /></span>
        </section>
      )}

      {ad && (
        <section className="pl-card pl-adcard" aria-label={H.yourAd}>
          <div className="pl-card-head">
            <span className="pl-h2">{H.yourAd}</span>
            <span className="pl-pill pl-pill--booked"><span className="pl-pill-dot" aria-hidden="true" />{C.ads.live}</span>
          </div>
          <p className="pl-adcard-name">{ad.ad?.name || C.kinds.ad}</p>
          <p className="pl-muted">{adLine || H.adRunning}</p>
          <button type="button" className="pl-cover v-stretch" onClick={() => onTab('ads')} aria-label={`${H.yourAd}: ${ad.ad?.name || C.kinds.ad}`}>{H.yourAd}</button>
        </section>
      )}

      {client.welcome && (
        <section className="pl-card pl-fromrob" aria-labelledby="pl-rob-h">
          <h2 className="pl-h2" id="pl-rob-h">{H.fromRob}</h2>
          <p className="pl-fromrob-text">{client.welcome}</p>
        </section>
      )}
    </>
  );
}
