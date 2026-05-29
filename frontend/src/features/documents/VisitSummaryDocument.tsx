import { useParams } from 'react-router-dom';
import { deriveAge, formatDate, formatFullDateTime } from '@/lib/datetime';
import { displayStatus } from '@/features/booking/status';
import { DocumentShell } from './DocumentShell';
import { useDocumentData, referenceFor, patientIdFor, bmiFor } from './useDocumentData';

const SHEET_CSS = `
.vs { padding:56px 60px 50px; }
.vs-lh { display:flex; justify-content:space-between; align-items:flex-start; }
.vs-brand { display:flex; align-items:center; gap:14px; }
.vs-brand .name { font-size:23px; font-weight:700; letter-spacing:-0.02em; color:#1A1A1A; }
.vs-brand .tag { font-size:11px; font-weight:500; color:#6B7280; letter-spacing:.02em; margin-top:1px; }
.vs-right { text-align:right; }
.vs-doc { font-size:18px; font-weight:700; color:#012050; letter-spacing:-0.01em; }
.vs-ref { font-size:11.5px; color:#6B7280; margin-top:4px; }
.vs-ref b { color:#3A4250; font-weight:600; }
.vs-rule { height:2px; background:#023A78; margin:16px 0 0; }
.vs-meta { display:grid; grid-template-columns:1fr 1fr 1fr; gap:0; margin-top:22px; }
.vs-col { padding-right:22px; }
.vs-col + .vs-col { border-left:1px solid #EAEDF2; padding-left:22px; }
.vs-h { font-size:10px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:#023A78; margin-bottom:9px; }
.vs-kv { display:flex; flex-direction:column; gap:1px; margin-bottom:9px; }
.vs-kv:last-child { margin-bottom:0; }
.vs-kv .k { font-size:10.5px; color:#6B7280; font-weight:500; }
.vs-kv .v { font-size:13px; color:#1A1A1A; font-weight:600; }
.vs-reason { margin-top:24px; border:1px solid #D9DEE6; border-left:3px solid #023A78;
  border-radius:4px; padding:12px 15px; background:#FBFCFE; }
.vs-reason .k { font-size:10px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:#6B7280; }
.vs-reason .v { font-size:13.5px; color:#1A1A1A; margin-top:3px; line-height:1.5; }
.vs-body { margin-top:8px; }
.vs-sec { padding:18px 0 16px; border-bottom:1px solid #EAEDF2; display:grid; grid-template-columns:132px 1fr; gap:20px; }
.vs-sec .label { font-size:11px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#023A78; padding-top:1px; }
.vs-sec .label .n { display:block; font-size:22px; font-weight:700; color:#D9DEE6; letter-spacing:0; margin-bottom:2px; line-height:1; }
.vs-sec p { margin:0; font-size:13.5px; line-height:1.66; color:#3A4250; }
.vs-sec p.muted { color:#6B7280; }
.vs-vitals { display:flex; flex-wrap:wrap; gap:10px; margin:0 0 12px; }
.vs-vital { flex:0 0 auto; min-width:150px; border:1px solid #D9DEE6; border-radius:5px; padding:8px 10px; }
.vs-vital .vl { font-size:9.5px; font-weight:600; letter-spacing:.05em; text-transform:uppercase; color:#6B7280; }
.vs-vital .vv { font-size:16px; font-weight:700; color:#1A1A1A; margin-top:2px; }
.vs-vital .vu { font-size:10px; font-weight:500; color:#6B7280; }
.vs-vital .vsrc { font-size:9px; font-weight:600; letter-spacing:.03em; text-transform:uppercase; color:#6B7280; margin-top:5px; padding-top:5px; border-top:1px dotted #D9DEE6; }
.vs-rx { margin-top:22px; }
.vs-rx-head { display:flex; align-items:center; gap:9px; margin-bottom:11px; }
.vs-rx-head .t { font-size:11px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#023A78; }
.vs-rx-forrec { font-size:10px; font-weight:600; letter-spacing:.04em; text-transform:uppercase; color:#6B7280; background:#F6F8FB; border:1px solid #D9DEE6; border-radius:999px; padding:3px 9px; }
table.vs-rx-table { width:100%; border-collapse:collapse; }
table.vs-rx-table th { text-align:left; font-size:9.5px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#6B7280; padding:8px 12px; background:#F6F8FB; border:1px solid #D9DEE6; }
table.vs-rx-table td { font-size:12.5px; color:#1A1A1A; padding:10px 12px; border:1px solid #D9DEE6; vertical-align:top; }
table.vs-rx-table td .med { font-weight:600; }
.vs-rx-pointer { display:flex; align-items:flex-start; gap:8px; margin-top:11px; font-size:11px; line-height:1.55; color:#6B7280; }
.vs-rx-pointer b { color:#3A4250; font-weight:600; }
.vs-sign { margin-top:34px; display:flex; justify-content:space-between; align-items:flex-end; }
.vs-script { font-family:'Caveat','Segoe Script',cursive; font-size:38px; font-weight:600; color:#012050; border-bottom:1px solid #1A1A1A; padding:0 30px 2px 4px; display:inline-block; line-height:1; }
.vs-sname { font-size:13px; font-weight:700; color:#1A1A1A; margin-top:8px; }
.vs-slic { font-size:11px; color:#6B7280; margin-top:2px; }
.vs-esign { display:inline-flex; align-items:center; gap:7px; font-size:11px; font-weight:600; color:#2C7A52; background:#EDF5EF; border:1px solid #CDE4D6; border-radius:999px; padding:5px 11px; }
.vs-ts { font-size:11px; color:#6B7280; margin-top:8px; line-height:1.5; text-align:right; }
.vs-foot { margin-top:auto; padding-top:14px; border-top:1px solid #D9DEE6; }
.vs-conf { font-size:10px; color:#6B7280; line-height:1.55; }
.vs-conf b { color:#3A4250; font-weight:600; }
.vs-foot-row { display:flex; justify-content:space-between; align-items:center; margin-top:9px; }
.vs-foot-row span { font-size:10px; color:#6B7280; }
`;

function Soap({ letter, label, text }: { letter: string; label: string; text: string | null }) {
  return (
    <div className="vs-sec">
      <div className="label">
        <span className="n">{letter}</span>
        {label}
      </div>
      {text ? <p>{text}</p> : <p className="muted">Not recorded at this visit.</p>}
    </div>
  );
}

export function VisitSummaryDocument() {
  const { bookingId = '' } = useParams();
  const data = useDocumentData(bookingId);
  const { booking, record, patient } = data;

  return (
    <DocumentShell
      title="Heron — Visit Summary"
      toolbarLabel={
        <>
          Visit Summary — generated when a patient taps <b>Download PDF</b>
        </>
      }
      state={data}
    >
      {booking && (
        <div className="doc-sheet vs">
          <style>{SHEET_CSS}</style>
          <img className="doc-wm" src="/brand/heron.svg" alt="" aria-hidden="true" />

          {(() => {
            const year = new Date(booking.startsAt).getFullYear();
            const reference = referenceFor(booking.id, year);
            const durationMin = Math.max(
              0,
              Math.round(
                (new Date(booking.endsAt).getTime() - new Date(booking.startsAt).getTime()) / 60000,
              ),
            );
            const bmi = bmiFor(patient?.weightKg ?? null, patient?.heightCm ?? null);
            const finalized = record?.finalizedAt ?? null;
            return (
              <>
                {/* letterhead */}
                <div className="vs-lh">
                  <div className="vs-brand">
                    <img src="/brand/heron.svg" width={56} height={56} alt="" />
                    <div>
                      <div className="name">Heron</div>
                      <div className="tag">Telehealth Care · care, watched closely</div>
                    </div>
                  </div>
                  <div className="vs-right">
                    <div className="vs-doc">Visit Summary</div>
                    <div className="vs-ref">
                      Reference <b className="doc-num">{reference}</b>
                      <br />
                      Issued <span className="doc-num">{formatDate(booking.startsAt)}</span>
                    </div>
                  </div>
                </div>
                <div className="vs-rule" />

                {/* meta band */}
                <div className="vs-meta">
                  <div className="vs-col">
                    <div className="vs-h">Patient</div>
                    <div className="vs-kv">
                      <span className="k">Name</span>
                      <span className="v">{patient?.name ?? 'Not provided'}</span>
                    </div>
                    <div className="vs-kv">
                      <span className="k">Date of birth</span>
                      <span className="v doc-num">
                        {patient?.birthday
                          ? `${formatDate(patient.birthday)} · ${deriveAge(patient.birthday)} y`
                          : 'Not provided'}
                      </span>
                    </div>
                    <div className="vs-kv">
                      <span className="k">Sex</span>
                      <span className="v">{patient?.sexLabel ?? 'Not provided'}</span>
                    </div>
                    <div className="vs-kv">
                      <span className="k">Patient ID</span>
                      <span className="v doc-num">{patientIdFor(patient?.userId)}</span>
                    </div>
                  </div>
                  <div className="vs-col">
                    <div className="vs-h">Visit</div>
                    <div className="vs-kv">
                      <span className="k">Date &amp; time</span>
                      <span className="v doc-num">{formatFullDateTime(booking.startsAt, true)}</span>
                    </div>
                    <div className="vs-kv">
                      <span className="k">Type</span>
                      <span className="v">Secure video consult</span>
                    </div>
                    <div className="vs-kv">
                      <span className="k">Duration</span>
                      <span className="v doc-num">{durationMin} minutes</span>
                    </div>
                    <div className="vs-kv">
                      <span className="k">Status</span>
                      <span className="v">{displayStatus(booking, Date.now())}</span>
                    </div>
                  </div>
                  <div className="vs-col">
                    <div className="vs-h">Clinician</div>
                    <div className="vs-kv">
                      <span className="k">Name</span>
                      <span className="v">{booking.doctorName ?? 'Not provided'}</span>
                    </div>
                    <div className="vs-kv">
                      <span className="k">Specialty</span>
                      <span className="v">{booking.doctorSpecializationLabel ?? '—'}</span>
                    </div>
                    <div className="vs-kv">
                      <span className="k">PRC License</span>
                      <span className="v doc-num">{booking.doctorPrcLicenseNo ?? '—'}</span>
                    </div>
                    <div className="vs-kv">
                      <span className="k">PTR No.</span>
                      <span className="v doc-num">{booking.doctorPtrNo ?? '—'}</span>
                    </div>
                  </div>
                </div>

                {/* reason */}
                <div className="vs-reason">
                  <div className="k">Reason for visit</div>
                  <div className="v">
                    {booking.concernNote ?? 'Not recorded.'}
                  </div>
                </div>

                {/* SOAP */}
                <div className="vs-body">
                  <Soap letter="S" label="Subjective" text={record?.subjective ?? null} />
                  <div className="vs-sec">
                    <div className="label">
                      <span className="n">O</span>
                      Objective
                    </div>
                    <div>
                      {bmi && (
                        <div className="vs-vitals">
                          <div className="vs-vital">
                            <div className="vl">BMI</div>
                            <div className="vv doc-num">{bmi}</div>
                            <div className="vu">kg/m²</div>
                            <div className="vsrc">Patient-reported</div>
                          </div>
                        </div>
                      )}
                      {record?.objective ? (
                        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.66, color: '#3A4250' }}>
                          {record.objective}
                        </p>
                      ) : (
                        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.66, color: '#6B7280' }}>
                          Not recorded at this visit.
                        </p>
                      )}
                    </div>
                  </div>
                  <Soap letter="A" label="Assessment" text={record?.assessment ?? null} />
                  <Soap letter="P" label="Plan" text={record?.plan ?? null} />
                </div>

                {/* medications */}
                <div className="vs-rx">
                  <div className="vs-rx-head">
                    <span className="t">Medications prescribed</span>
                    <span className="vs-rx-forrec">For your records</span>
                  </div>
                  {record && record.prescription.length > 0 ? (
                    <table className="vs-rx-table">
                      <thead>
                        <tr>
                          <th style={{ width: '34%' }}>Medication</th>
                          <th style={{ width: '20%' }}>Dosage</th>
                          <th style={{ width: '46%' }}>Directions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {record.prescription.map((item, i) => (
                          <tr key={i}>
                            <td>
                              <span className="med">{item.medication}</span>
                            </td>
                            <td className="doc-num">{item.dosage ?? '—'}</td>
                            <td>{item.instructions ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p style={{ fontSize: 12.5, color: '#6B7280', margin: 0 }}>
                      No medication was prescribed at this visit.
                    </p>
                  )}
                  {record && record.prescription.length > 0 && (
                    <div className="vs-rx-pointer">
                      <span>
                        To have these dispensed, present your separate{' '}
                        <b>prescription</b> at any licensed pharmacy. This summary is a
                        clinical record, not a dispensable prescription.
                      </span>
                    </div>
                  )}
                </div>

                {/* signature */}
                <div className="vs-sign">
                  <div>
                    <div className="vs-script">{booking.doctorName ?? 'Heron clinician'}</div>
                    <div className="vs-sname">{booking.doctorName ?? 'Heron clinician'}</div>
                    <div className="vs-slic doc-num">
                      {booking.doctorSpecializationLabel ?? 'Clinician'} · PRC Lic.{' '}
                      {booking.doctorPrcLicenseNo ?? '—'}
                    </div>
                  </div>
                  <div>
                    <span className="vs-esign">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"
                        strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                      Electronically signed
                    </span>
                    {finalized && (
                      <div className="vs-ts">
                        Finalized {formatFullDateTime(finalized, true)}
                        <br />
                        Verified by Heron · doc {reference}
                      </div>
                    )}
                  </div>
                </div>

                {/* footer */}
                <div className="vs-foot">
                  <p className="vs-conf">
                    <b>Confidential medical record.</b> This summary is intended only for
                    the named patient and contains protected health information under the
                    Philippine Data Privacy Act (RA 10173). If you received it in error,
                    please delete it and notify Heron. This document reflects a telehealth
                    consultation and is <b>not a substitute for emergency care</b> — for
                    sudden or severe symptoms, call <b>911</b> or your local emergency
                    number.
                  </p>
                  <div className="vs-foot-row">
                    <span>© {year} Heron Care · heron.health</span>
                    <span className="doc-num">{reference}</span>
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
