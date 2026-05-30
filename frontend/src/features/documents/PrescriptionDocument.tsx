import { useParams } from 'react-router-dom';
import { deriveAge, formatDate } from '@/lib/datetime';
import { DocumentShell } from './DocumentShell';
import { useDocumentData, referenceFor } from './useDocumentData';

const SHEET_CSS = `
.rx { padding:54px 60px 48px; }
.rx-head { display:flex; justify-content:space-between; align-items:flex-start; gap:24px; }
.rx-doc .dname { font-size:22px; font-weight:700; letter-spacing:-0.02em; color:#1A1A1A; }
.rx-doc .dspec { font-size:13px; font-weight:600; color:#023A78; margin-top:2px; letter-spacing:.01em; }
.rx-doc .dlic { font-size:11.5px; color:#6B7280; margin-top:8px; line-height:1.7; }
.rx-doc .dlic b { color:#3A4250; font-weight:600; }
.rx-brand { display:flex; align-items:center; gap:9px; text-align:right; }
.rx-brand .b-name { font-size:16px; font-weight:700; letter-spacing:-0.01em; color:#1A1A1A; }
.rx-brand .b-tag { font-size:10.5px; color:#6B7280; margin-top:1px; }
.rx-rule { height:2px; background:#023A78; margin:18px 0 0; }
.rx-pt { display:flex; gap:28px; margin-top:20px; align-items:end; }
.rx-field { display:flex; align-items:baseline; gap:9px; }
.rx-field .fl { font-size:11px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; color:#6B7280; white-space:nowrap; }
.rx-field .fv { font-size:14px; font-weight:600; color:#1A1A1A; border-bottom:1px solid #D9DEE6; flex:1; padding:0 4px 3px; min-width:90px; }
.rx-wrap { display:flex; gap:18px; margin-top:34px; flex:1; }
.rx-sym { font-family:Georgia,'Times New Roman',serif; font-size:58px; font-weight:700; color:#023A78; line-height:.8; flex:none; }
.rx-items { flex:1; display:flex; flex-direction:column; gap:24px; padding-top:6px; }
.rx-item .line1 { display:flex; align-items:baseline; justify-content:space-between; gap:16px; }
.rx-item .drug { font-size:17px; font-weight:700; color:#1A1A1A; letter-spacing:-0.01em; }
.rx-item .qty { font-size:15px; font-weight:700; color:#1A1A1A; white-space:nowrap; font-variant-numeric:tabular-nums; }
.rx-item .sig { font-size:14px; color:#3A4250; margin-top:5px; line-height:1.5; }
.rx-item .sig .sig-k { font-weight:700; color:#023A78; font-style:italic; margin-right:6px; }
.rx-item .gen-note { font-size:11px; color:#6B7280; margin-top:4px; }
.rx-item-sep { height:1px; background:#EAEDF2; }
.rx-empty { font-size:14px; color:#6B7280; padding-top:6px; }
.rx-sign { display:flex; justify-content:flex-end; margin-top:30px; }
.rx-sign-box { text-align:center; }
.rx-sign-box .script { font-family:'Caveat','Segoe Script',cursive; font-size:36px; font-weight:600; color:#012050; line-height:1; margin-bottom:4px; }
.rx-sign-box .sline { width:250px; border-top:1px solid #1A1A1A; padding-top:7px; }
.rx-sign-box .sname { font-size:13.5px; font-weight:700; color:#1A1A1A; }
.rx-sign-box .slic { font-size:11px; color:#6B7280; margin-top:2px; }
.rx-foot { margin-top:28px; padding-top:13px; border-top:1px solid #D9DEE6; }
.rx-legal { font-size:10px; color:#6B7280; line-height:1.6; }
.rx-legal b { color:#3A4250; font-weight:600; }
.rx-foot-row { display:flex; justify-content:space-between; margin-top:8px; }
.rx-foot-row span { font-size:10px; color:#6B7280; }
`;

export function PrescriptionDocument() {
  const { bookingId = '' } = useParams();
  const data = useDocumentData(bookingId);
  const { booking, record, patient } = data;
  const hasRx = !!record && record.prescription.length > 0;

  return (
    <DocumentShell
      title="Heron — Prescription"
      toolbarLabel={
        <>
          Prescription — present at <b>any licensed pharmacy</b>
        </>
      }
      state={data}
    >
      {booking && (
        <div className="doc-sheet rx">
          <style>{SHEET_CSS}</style>
          <img className="doc-wm" src="/brand/heron.svg" alt="" aria-hidden="true" />

          {(() => {
            const year = new Date(booking.startsAt).getFullYear();
            const reference = referenceFor(booking.id, year).replace('HRN-', 'Rx HRN-');
            return (
              <>
                {/* prescriber header */}
                <div className="rx-head">
                  <div className="rx-doc">
                    <div className="dname">{booking.doctorName ?? 'Heron clinician'}</div>
                    <div className="dspec">{booking.doctorSpecializationLabel ?? 'Clinician'}</div>
                    <div className="dlic">
                      PRC License No. <b className="doc-num">{booking.doctorPrcLicenseNo ?? '—'}</b>
                      {'  ·  '}
                      PTR No. <b className="doc-num">{booking.doctorPtrNo ?? '—'}</b>
                      <br />
                      S2 License: <b>not applicable</b> (no dangerous drugs prescribed)
                    </div>
                  </div>
                  <div className="rx-brand">
                    <div>
                      <div className="b-name">Heron</div>
                      <div className="b-tag">Telehealth consult · heron.health</div>
                    </div>
                    <img src="/brand/heron.svg" width={50} height={50} alt="" />
                  </div>
                </div>
                <div className="rx-rule" />

                {/* patient line */}
                <div className="rx-pt" style={{ marginTop: 20 }}>
                  <div className="rx-field" style={{ flex: 2 }}>
                    <span className="fl">Patient</span>
                    <span className="fv">{patient?.name ?? 'Not provided'}</span>
                  </div>
                </div>
                <div className="rx-pt" style={{ marginTop: 14 }}>
                  <div className="rx-field" style={{ width: 150 }}>
                    <span className="fl">Age</span>
                    <span className="fv doc-num">
                      {patient?.birthday ? deriveAge(patient.birthday) : '—'}
                    </span>
                  </div>
                  <div className="rx-field" style={{ width: 150 }}>
                    <span className="fl">Sex</span>
                    <span className="fv">{patient?.sexLabel ?? '—'}</span>
                  </div>
                  <div className="rx-field" style={{ flex: 1 }}>
                    <span className="fl">Date</span>
                    <span className="fv doc-num">{formatDate(booking.startsAt)}</span>
                  </div>
                </div>

                {/* Rx body */}
                <div className="rx-wrap">
                  <div className="rx-sym">℞</div>
                  <div className="rx-items">
                    {hasRx ? (
                      record!.prescription.map((item, i) => (
                        <div key={i}>
                          <div className="rx-item">
                            <div className="line1">
                              <span className="drug">{item.medication}</span>
                            </div>
                            {(item.dosage || item.instructions) && (
                              <div className="sig">
                                <span className="sig-k">Sig:</span>
                                {[item.dosage, item.instructions].filter(Boolean).join(' — ')}
                              </div>
                            )}
                            <div className="gen-note">
                              Generic name dispensed unless a brand is specified by the patient.
                            </div>
                          </div>
                          {i < record!.prescription.length - 1 && <div className="rx-item-sep" />}
                        </div>
                      ))
                    ) : (
                      <p className="rx-empty">
                        No medication was prescribed at this visit.
                      </p>
                    )}
                  </div>
                </div>

                {/* signature */}
                <div className="rx-sign">
                  <div className="rx-sign-box">
                    <div className="script">{booking.doctorName ?? 'Heron clinician'}</div>
                    <div className="sline">
                      <div className="sname">{booking.doctorName ?? 'Heron clinician'}</div>
                      <div className="slic doc-num">
                        PRC Lic. {booking.doctorPrcLicenseNo ?? '—'} · PTR{' '}
                        {booking.doctorPtrNo ?? '—'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* legal footer */}
                <div className="rx-foot">
                  <p className="rx-legal">
                    <b>Issued under the Generics Act of 1988 (RA 6675)</b> — generic names
                    are written; a brand in parentheses is a suggestion only and the patient
                    may request the generic equivalent. Valid as a private outpatient
                    prescription. This is the only document to present at a pharmacy; your
                    clinical record is kept separately in the Heron app.
                  </p>
                  <div className="rx-foot-row">
                    <span>© {year} Heron Care · Issued via telehealth consult</span>
                    <span className="doc-num">
                      {reference} · {formatDate(booking.startsAt)}
                    </span>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </DocumentShell>
  );
}
