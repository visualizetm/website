import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import LogoSpinner from './ui/LogoSpinner';
import BootFrame from './shell/BootFrame';
import { IS_ADMIN_HOST, IS_DEV_HOST } from './lib/adminPaths';

/* Code split by host (Prompt 15): the admin host never downloads the
 * marketing pages and the marketing site never downloads the admin. Each
 * page is its own chunk; the shell components load with the first page. */
const Navbar = lazy(() => import('./components/Navbar'));
const Footer = lazy(() => import('./components/Footer'));
const Home = lazy(() => import('./pages/Home'));
const Services = lazy(() => import('./pages/Services'));
const Clients = lazy(() => import('./pages/Clients'));
const CaseStudy = lazy(() => import('./pages/CaseStudy'));
const Contact = lazy(() => import('./pages/Contact'));
const LeadPartner = lazy(() => import('./pages/LeadPartner'));
const Start = lazy(() => import('./pages/Start'));
const SceneTest = lazy(() => import('./pages/SceneTest'));   // Site Prompt 11: the scene engine's proving ground, noindex, unlinked
/* The review form. Nothing links to it: it is a link Rob sends after a
 * delivery, so it is noindex and out of the sitemap. */
const Review = lazy(() => import('./pages/Review'));
const ReviewLink = lazy(() => import('./pages/ReviewLink'));   // review links: /r/<token>, a client reviewing me
const Portal = lazy(() => import('./pages/Portal'));           // client portal: /c/<token>, a client's home screen of cards
/* The client facing Content Planner, opened with a token Rob sends. Also
 * unlinked and noindex: it is somebody's own month, not a page to browse. */
const Concepts = lazy(() => import('./pages/Concepts'));
const Planner = lazy(() => import('./pages/Planner'));
/* The scroll engine's mount point (Site Prompt 6). Lazy, and rendered only
 * in the marketing branch below, so the admin's entry never carries the
 * loader or the gsap/lenis chunk URLs behind it. */
const ScrollRoot = lazy(() => import('./marketing/ScrollRoot'));
const AdminApp = lazy(() => import('./pages/AdminApp'));

/* /work/:slug moved to /clients/:slug (Site Prompt 3); this keeps the old
 * deep link's slug alive as a client-side fallback, vercel.json does the
 * real 301 for anyone hitting the server directly. */
function RedirectWorkSlug() {
  const { slug } = useParams();
  return <Navigate to={`/clients/${slug}`} replace />;
}

/* The marketing site's loading screen: the Logo spinner, a fixed layer over the page, shown only while a
 * chunk is on its way (it is the Suspense fallback; the parser painted one before this ran, index.html).
 * No timer and no minimum time: when the page is ready it is gone. The `app-loader` class is how the
 * layout audit recognizes the one full viewport layer a marketing route may have. */
const SiteLoading = () => <LogoSpinner layout="screen" className="app-loader" />;

/* The two standalone client pages and the concepts page get this while their chunk is on the way. It sits
 * in the page's own flow rather than in a fixed, full screen layer, so the arriving page takes its place
 * and it can never end up on top of content that has already rendered. A fixed layer can: see the
 * standalone branch below. */
const ClientBoot = () => <LogoSpinner layout="page" className="client-boot" />;

export default function App() {
  const location = useLocation();
  // ── Host split ─────────────────────────────────────────────────
  // admin.visualizeclients.com serves ONLY the admin app, at root paths.
  if (IS_ADMIN_HOST) {
    // The old print dashboard lived at /prints; Print Orders replaced it (Prompt 13).
    if (location.pathname === '/prints' || location.pathname === '/admin/prints') return <Navigate to="/orders" replace />;
    // The same boot frame the parser painted (index.html) stays up while the admin chunk loads, then AdminApp renders it again until the session answers.
    return <Suspense fallback={<BootFrame />}><AdminApp /></Suspense>;
  }

  // On the public domain the admin is not served (vercel.json also blocks it
  // at the edge). Localhost keeps /admin/* working for development.
  if (location.pathname.startsWith('/admin')) {
    if (!IS_DEV_HOST) return <Navigate to="/" replace />;
    if (location.pathname === '/admin/prints') return <Navigate to="/admin/orders" replace />;
    return <Suspense fallback={<BootFrame />}><AdminApp /></Suspense>;
  }

  // Routes outside the normal navbar/footer layout.
  // The print shop was retired (Site Prompt 6, Part 3); vercel.json 301s
  // /prints and /prints/* to /, this is the client-side fallback for a
  // link followed inside an already-loaded session.
  if (location.pathname === '/prints' || location.pathname.startsWith('/prints/')) return <Navigate to="/" replace />;
  // The client portal and intake form were retired (Prompt 13); old links land on Contact with a notice.
  if (location.pathname === '/portal' || location.pathname.startsWith('/intake')) return <Navigate to="/contact?from=portal" replace />;

  /* The two pages a client reaches by a link Rob sends stand alone: no
   * navbar, no hamburger, no marketing footer, no theme control, and no
   * scroll engine. They are somebody's own planner or their own review
   * form, not a page on the site, and the navigation only invites them to
   * wander off in the middle of it. Each page carries its own slim bar and
   * a one line footer (src/components/ClientPageChrome.jsx). */
  /* The concepts presentation (Concepts rebuild) stands alone the same way,
   * but it is built on the Scene engine, so it is the one standalone page
   * that mounts ScrollRoot. */
  if (location.pathname.startsWith('/concepts/')) {
    return (
      <Suspense fallback={<ClientBoot />}>
        <ScrollRoot />
        <main className="page-shell page-fade" key={location.pathname}>
          <Routes location={location}>
            <Route path="/concepts/:token" element={<Concepts />} />
          </Routes>
        </main>
      </Suspense>
    );
  }
  if (location.pathname.startsWith('/planner/') || location.pathname === '/review' || location.pathname.startsWith('/review/') || location.pathname.startsWith('/r/') || location.pathname.startsWith('/c/')) {
    /* No splash here. The marketing splash is a fixed, opaque, z-index 9999
     * layer on a 1300ms timer that has nothing to do with whether the page
     * is ready, and its Suspense fallback is hard coded to done={false},
     * which has no exit path of its own. On these pages that put the
     * finished planner under a black scrim for the best part of two
     * seconds, and left it there for as long as the page's chunk took to
     * arrive. ClientBoot is in the flow instead, so the page replaces it. */
    return (
      <Suspense fallback={<ClientBoot />}>
        <main className="page-shell page-fade" key={location.pathname}>
          <Routes location={location}>
            <Route path="/review" element={<Review />} />
            <Route path="/review/:slug" element={<Review />} />
            <Route path="/r/:token" element={<ReviewLink />} />
            <Route path="/c/:token" element={<Portal />} />
            <Route path="/planner/:token" element={<Planner />} />
          </Routes>
        </main>
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<SiteLoading />}>
      <ScrollRoot />
      <Navbar />
      <main className="page-shell page-fade" key={location.pathname}>
        <Routes location={location}>
          <Route path="/"            element={<Home />} />
          <Route path="/scene-test"  element={<SceneTest />} />
          <Route path="/services"    element={<Services />} />
          <Route path="/clients"        element={<Clients />} />
          <Route path="/clients/:slug"  element={<CaseStudy />} />
          <Route path="/work"        element={<Navigate to="/clients" replace />} />
          <Route path="/work/:slug"  element={<RedirectWorkSlug />} />
          <Route path="/showcase"    element={<Navigate to="/clients" replace />} />
          <Route path="/contact"     element={<Contact />} />
          <Route path="/book"        element={<Contact />} />
          <Route path="/lead-partner" element={<LeadPartner />} />
          <Route path="/pricing"     element={<Navigate to="/services" replace />} />
          <Route path="/start"       element={<Start />} />
        </Routes>
      </main>
      <Footer />
    </Suspense>
  );
}
