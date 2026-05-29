import { type ReactNode, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CrescentSpinner } from '@/components/shared/CrescentSpinner';
import type { DocumentData } from './useDocumentData';

// Base CSS shared by both printable documents: the dark on-screen backdrop, the
// A4 sheet, the crescent watermark, the screen-only toolbar + print button, and
// the @media print rules that strip everything but the sheet. Document-specific
// styling lives in each document's own <style>. Inter for the body; Caveat (loaded
// in index.html) is used only for the signature inside each document.
const BASE_CSS = `
.doc-bg { min-height:100vh; background:#565F6E; padding:32px 0 60px;
  font-family:'Inter',ui-sans-serif,system-ui,sans-serif; color:#1A1A1A;
  -webkit-font-smoothing:antialiased; }
.doc-num { font-variant-numeric: tabular-nums; }
.doc-toolbar { width:794px; max-width:calc(100% - 24px); margin:0 auto 18px;
  display:flex; align-items:center; justify-content:space-between; gap:16px; }
.doc-toolbar .tt { color:#D6DBE4; font-size:13px; font-weight:500; }
.doc-toolbar .tt b { color:#fff; font-weight:700; }
.doc-toolbar a { color:#D6DBE4; font-size:13px; text-decoration:none; }
.doc-toolbar a:hover { color:#fff; }
.doc-print-btn { display:inline-flex; align-items:center; gap:8px;
  font-family:'Inter',sans-serif; font-size:13px; font-weight:600; color:#012050;
  background:#fff; border:0; border-radius:8px; padding:9px 15px; cursor:pointer;
  box-shadow:0 2px 10px rgba(0,0,0,.2); }
.doc-print-btn:hover { background:#F0F4FA; }
.doc-sheet { width:794px; max-width:calc(100% - 24px); min-height:1123px;
  margin:0 auto; background:#fff; box-shadow:0 8px 40px rgba(0,0,0,.34);
  position:relative; overflow:hidden; display:flex; flex-direction:column; }
.doc-sheet > * { position:relative; z-index:1; }
.doc-wm { position:absolute !important; left:50%; top:52%;
  transform:translate(-50%,-50%); width:600px; opacity:.05; pointer-events:none;
  z-index:0 !important; }
.doc-center { min-height:60vh; display:flex; align-items:center; justify-content:center; }
.doc-msg { color:#EAEDF2; text-align:center; font-size:14px; line-height:1.6; }
.doc-msg a { color:#fff; text-decoration:underline; }
@media print {
  .doc-bg { background:#fff; padding:0; }
  .doc-toolbar { display:none; }
  .doc-sheet { box-shadow:none; margin:0; width:auto; max-width:none; min-height:100vh; }
  @page { size:A4; margin:0; }
}
`;

const PrinterIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z" />
  </svg>
);

// Frames a printable document: injects the base CSS, the toolbar (a label, a
// back-to-app link, and Print / Save as PDF), and the sheet. Handles the
// loading / error / not-found states so each document body assumes ready data.
export function DocumentShell({
  title,
  toolbarLabel,
  state,
  children,
}: {
  title: string;
  toolbarLabel: ReactNode;
  state: Pick<DocumentData, 'isPending' | 'isError' | 'notFound'>;
  children: ReactNode;
}) {
  // Drives the browser tab name, which becomes the default "Save as PDF" filename.
  useEffect(() => {
    const prev = document.title;
    document.title = title;
    return () => {
      document.title = prev;
    };
  }, [title]);

  return (
    <div className="doc-bg">
      <style>{BASE_CSS}</style>
      <div className="doc-toolbar">
        <span className="tt">{toolbarLabel}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 14 }}>
          <Link to="/appointments">Back to appointments</Link>
          <button type="button" className="doc-print-btn" onClick={() => window.print()}>
            <PrinterIcon />
            Print / Save as PDF
          </button>
        </span>
      </div>

      {state.isPending ? (
        <div className="doc-center">
          <CrescentSpinner size={48} variant="white" />
        </div>
      ) : state.notFound ? (
        <div className="doc-center">
          <p className="doc-msg">
            We couldn't find this visit.
            <br />
            <Link to="/appointments">Return to your appointments</Link>.
          </p>
        </div>
      ) : state.isError ? (
        <div className="doc-center">
          <p className="doc-msg">
            This document couldn't be loaded. Check your connection and try again.
          </p>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
