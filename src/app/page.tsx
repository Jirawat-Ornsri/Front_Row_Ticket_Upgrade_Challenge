"use client";

import { useMemo, useState } from "react";
import { buildFrontRowUpgradeQueue } from "../domain/queue";
import { mockEntries } from "../data/mockEntries";
import type { QueueMode, RankedEntry, TicketQueueEntry } from "../domain/types";

const initialNow = new Date("2026-11-10T10:00:00+07:00");
const timeSteps = [
  { label: "+5 min", minutes: 5 },
  { label: "+15 min", minutes: 15 },
  { label: "+1 hour", minutes: 60 },
];
function score(value: number) {
  return `${value.toFixed(1)}`;
}

function mask(value: string | null | undefined) {
  if (!value) return "Not provided";
  return `••••${value.slice(-4)}`;
}

function displayTime(value: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok",
  }).format(value);
}

function Membership({ value }: { value: TicketQueueEntry["membership"] }) {
  return <span className={`badge ${value === "vip" ? "badge-vip" : "badge-regular"}`}>{value ?? "Regular"}</span>;
}

function ReasonList({ reasons }: { reasons: string[] }) {
  return <ul className="reason-list">{reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>;
}

function CandidateCard({ candidate, winner = false, rank }: { candidate: RankedEntry; winner?: boolean; rank: number }) {
  return <article className={`candidate-card${winner ? " candidate-winner" : ""}`}>
    <div className="candidate-head"><span className="rank">#{rank}</span><span className="score"><strong>{score(candidate.score)}</strong><small> / 100</small></span></div>
    <h3>{candidate.entry.fanName}</h3>
    <p className="muted">Ticket {candidate.entry.id} <span aria-hidden="true">·</span> Fan {candidate.entry.fanId}</p>
    <Membership value={candidate.entry.membership} />
    <ReasonList reasons={candidate.reasons} />
  </article>;
}

export default function Home() {
  const [entries, setEntries] = useState<TicketQueueEntry[]>(() => mockEntries.map((entry) => ({ ...entry })));
  const [now, setNow] = useState(initialNow);
  const [mode, setMode] = useState<QueueMode>("default");
  const [loyaltyDrafts, setLoyaltyDrafts] = useState<Record<string, string>>({});
  const result = useMemo(() => buildFrontRowUpgradeQueue(entries, now, mode), [entries, now, mode]);

  function updateLoyalty(id: string, raw: string) {
    setLoyaltyDrafts((current) => ({ ...current, [id]: raw }));
    const points = Number(raw);
    if (!Number.isFinite(points) || points < 0) return;
    setEntries((current) => current.map((entry) => entry.id === id ? { ...entry, loyaltyPoints: points } : entry));
  }

  function finishLoyaltyEdit(id: string) {
    setLoyaltyDrafts((current) => {
      const remaining = { ...current };
      delete remaining[id];
      return remaining;
    });
  }

  return <main className="dashboard">
    <header className="page-header">
      <div><p className="eyebrow">LIVE EVENT OPERATIONS</p><h1>Front Row Upgrade Queue</h1><p className="subtitle">A clear view of the queue, the decision, and what shapes it.</p><label>Queue mode <select value={mode} onChange={(event) => setMode(event.target.value as QueueMode)}><option value="default">Default</option><option value="rush-hour">Rush Hour</option><option value="vip-hour">VIP Hour</option><option value="fair-queue">Fair Queue Mode</option></select></label></div>
      <div className="clock-card"><span className="clock-label">SIMULATED CURRENT TIME</span><strong>{displayTime(now)}</strong><div className="time-buttons" aria-label="Advance simulated time">{timeSteps.map(({ label, minutes }) => <button key={minutes} type="button" onClick={() => setNow((current) => new Date(current.getTime() + minutes * 60_000))}>{label}</button>)}</div></div>
    </header>

    <section className="winner-panel" aria-labelledby="winner-title">
      {result.winner ? <>
        <div className="winner-copy"><p className="eyebrow light">THE FRONT ROW UPGRADE</p><h2 id="winner-title">{result.winner.entry.fanName}</h2><p className="winner-meta">Ticket {result.winner.entry.id} <span>·</span> Fan {result.winner.entry.fanId} <span>·</span> <Membership value={result.winner.entry.membership} /></p>
          <h3>Why this account won</h3><ReasonList reasons={result.winner.reasons} />
        </div><div className="winner-score"><span>FINAL SCORE</span><strong>{score(result.winner.score)}</strong><small>out of 100</small><div className="group-chip">{result.fanGroups.find((group) => group.representative?.entry.id === result.winner?.entry.id)?.entries.length ?? 1} linked account(s)</div></div>
      </> : <div className="empty-winner"><p className="eyebrow light">THE FRONT ROW UPGRADE</p><h2 id="winner-title">No eligible candidates</h2><p>There is no waiting account that currently meets the queue requirements.</p></div>}
    </section>

    <section className="section" aria-labelledby="top-title"><div className="section-heading"><div><p className="eyebrow">QUEUE STANDINGS</p><h2 id="top-title">Top candidates</h2></div><span className="section-count">{result.rankedCandidates.length} eligible</span></div>
      {result.topCandidates.length ? <div className="candidate-grid">{result.topCandidates.map((candidate, index) => <CandidateCard key={candidate.entry.id} candidate={candidate} rank={index + 1} winner={candidate.entry.id === result.winner?.entry.id} />)}</div> : <div className="empty-card">No eligible candidates to rank.</div>}
    </section>

    <section className="section" aria-labelledby="groups-title"><div className="section-heading"><div><p className="eyebrow">ACCOUNT CONNECTIONS</p><h2 id="groups-title">Fan groups</h2></div><span className="section-count">{result.fanGroups.length} groups</span></div>
      {result.fanGroups.length ? <div className="group-list">{result.fanGroups.map((group, index) => <details className="group-card" key={group.id} open={index === 0}>
        <summary><span className="group-number">Group {String(index + 1).padStart(2, "0")}</span><span className="group-summary">{group.entries.length} {group.entries.length === 1 ? "account" : "accounts"} <span aria-hidden="true">·</span> {group.representative ? `Representative: ${group.representative.entry.fanName}` : "No representative"}</span><span className="disclosure" aria-hidden="true">⌄</span></summary>
        <div className="group-content">
          {group.connectionReasons.length > 0 ? <div className="connection-note"><strong>Connected because</strong><ul>{group.connectionReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></div> : <p className="muted">No shared identifiers found for this account.</p>}
          <div className="account-list">{group.entries.map((entry) => <div className="account-row" key={entry.id}><div className="account-name"><strong>{entry.fanName}</strong><span>{entry.id} · <Membership value={entry.membership} /></span></div><label className="loyalty-input">Loyalty points<input aria-label={`${entry.fanName} loyalty points`} type="number" min="0" step="1" value={loyaltyDrafts[entry.id] ?? entry.loyaltyPoints ?? 0} onChange={(event) => updateLoyalty(entry.id, event.target.value)} onBlur={() => finishLoyaltyEdit(entry.id)} /></label><div className="private-data"><span>Phone {mask(entry.phoneNumber)}</span><span>Device {mask(entry.deviceId)}</span><span>Payment {mask(entry.paymentAccount)}</span></div>{group.representative?.entry.id === entry.id && <span className="rep-badge">REPRESENTATIVE</span>}</div>)}</div>
        </div>
      </details>)}</div> : <div className="empty-card">Fan groups will appear when eligible accounts are available.</div>}
    </section>

    <section className="section excluded-section" aria-labelledby="excluded-title"><div className="section-heading"><div><p className="eyebrow">NOT IN THE RUNNING</p><h2 id="excluded-title">Excluded entries</h2></div><span className="section-count">{result.excludedEntries.length} excluded</span></div>
      {result.excludedEntries.length ? <div className="excluded-list">{result.excludedEntries.map(({ entry, reason }) => <article className="excluded-row" key={entry.id}><span className="excluded-icon" aria-hidden="true">–</span><div><strong>{entry.fanName}</strong><p>{entry.id} <span aria-hidden="true">·</span> {entry.status} <span aria-hidden="true">·</span> {entry.membership ?? "Membership not provided"}</p></div><span className="exclusion-reason">{reason}</span></article>)}</div> : <div className="empty-card">No entries are excluded.</div>}
    </section>
    <footer className="footer-note">Queue recalculates automatically when time or loyalty points change. Loyalty edits apply only to this session.</footer>
  </main>;
}
