import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { calldataBytes, CALLDATA_LIMIT } from "./lib/calldata";
import { CONTRACT_ADDRESS, EXPLORER_BASE } from "./lib/config";
import { errorMessage } from "./lib/errors";
import { gen, parseGen } from "./lib/gen";
import {
  connectedWallet, getBalances, getJar, getReplies, requestWallet, sendWrite, waitForVerdict,
} from "./lib/genlayer";
import { jarId, jarIdFromInput, short } from "./lib/ids";
import { pyLen, pyStrip } from "./lib/pytext";
import {
  closeBlock, commentBlock, fundBlock, hasReplied, isCreator, MAX_COMMENT_LENGTH, MAX_TITLE_LENGTH, movedTip, openBlock,
  REVERTS, UI, withdrawAllowanceBlock, withdrawEarningsBlock,
} from "./lib/rules";
import type { Balances, Jar, Reply, TxStatus } from "./lib/types";
import {
  closeVerified, fundVerified, openVerified, replyVerified, withdrawAllowanceVerified, withdrawEarningsVerified,
} from "./lib/verify";

type Verify = () => Promise<string | null>;

const IDLE: TxStatus = { phase: "idle", message: "" };

function jarFromUrl(): string {
  return jarIdFromInput(new URLSearchParams(window.location.search).get("jar") ?? "");
}

function setUrlJar(id: string) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("jar", id);
  else url.searchParams.delete("jar");
  window.history.replaceState(null, "", url.toString());
}

export default function App() {
  const [me, setMe] = useState("");
  const [jarIdLoaded, setJarIdLoaded] = useState(jarFromUrl());
  const [findInput, setFindInput] = useState("");
  const [jar, setJar] = useState<Jar | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [balances, setBalances] = useState<Balances | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [tipGen, setTipGen] = useState("");
  const [titleTaken, setTitleTaken] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [fundGen, setFundGen] = useState("");
  const [withdrawGen, setWithdrawGen] = useState("");

  const [status, setStatus] = useState<TxStatus>(IDLE);
  const [busy, setBusy] = useState(false);
  const [highlight, setHighlight] = useState<number | null>(null);
  const recheck = useRef<Verify | null>(null);

  // ---------- reads ----------
  const loadBalances = useCallback(async (wallet: string) => {
    if (!wallet) return setBalances(null);
    try {
      setBalances(await getBalances(wallet));
    } catch {
      setBalances(null);
    }
  }, []);

  const loadJar = useCallback(async (id: string) => {
    if (!id) {
      setJar(null);
      setReplies([]);
      return;
    }
    setLoading(true);
    setLoadError("");
    try {
      const j = await getJar(id);
      setJar(j);
      setReplies(j ? await getReplies(id) : []);
      if (!j) setLoadError("Unknown jar id");
    } catch (e) {
      setLoadError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    connectedWallet().then(setMe).catch(() => setMe(""));
    const eth = window.ethereum;
    // A status line belongs to the wallet that sent it: clear it when the account changes.
    const onAccounts = (accounts: string[]) => {
      setMe((accounts?.[0] ?? "").toLowerCase());
      recheck.current = null;
      setStatus(IDLE);
      setHighlight(null);
    };
    eth?.on?.("accountsChanged", onAccounts);
  }, []);

  useEffect(() => {
    void loadJar(jarIdLoaded);
    setUrlJar(jarIdLoaded);
  }, [jarIdLoaded, loadJar]);

  useEffect(() => {
    void loadBalances(me);
  }, [me, loadBalances]);

  // ---------- derived ----------
  const tip = parseGen(tipGen);
  const newJarId = me && pyLen(pyStrip(title)) > 0 ? jarId(me, title) : "";
  useEffect(() => {
    let live = true;
    setTitleTaken(false);
    if (!newJarId) return;
    const t = setTimeout(() => {
      getJar(newJarId).then((j) => live && setTitleTaken(!!j)).catch(() => undefined);
    }, 400);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [newJarId]);
  const openReason = !me ? UI.noWallet : openBlock({ title, tipWei: tip.ok ? tip.wei : null, exists: titleTaken });
  // An unparseable tip shows the UI's own hint instead of the contract's range sentence.
  const openShown = openReason === REVERTS.tipRange && tipGen && !tip.ok ? tip.reason : openReason;

  const replyBytes = useMemo(
    () => (jar ? calldataBytes("comment", [jar.jar_id, replyText]) : 0),
    [jar, replyText],
  );
  const replied = hasReplied(replies, me);
  const replyReason = jar
    ? commentBlock({ jar, me, replied, text: replyText, allowance: balances?.allowance ?? "0", bytes: replyBytes })
    : null;
  const closeReason = jar ? closeBlock(jar, me) : null;
  const fund = parseGen(fundGen);
  const fundReason = fundBlock(me, fund.ok ? fund.wei : null);
  const wd = parseGen(withdrawGen);
  const withdrawReason = withdrawAllowanceBlock(me, balances, wd.ok ? wd.wei : null);
  const earningsReason = withdrawEarningsBlock(me, balances);

  // ---------- writes ----------
  async function connect() {
    try {
      setMe(await requestWallet());
    } catch (e) {
      setStatus({ phase: "error", message: errorMessage(e) });
    }
  }

  async function runWrite(action: string, method: string, args: unknown[], value: bigint, verify: Verify) {
    setBusy(true);
    recheck.current = null;
    try {
      setStatus({ phase: "signing", message: "Confirm the transaction in your wallet…", action });
      const hash = await sendWrite(me, method, args, value);
      setStatus({ phase: "submitted", message: "Submitted. Waiting for validators to accept it…", hash, action });
      const verdict = await waitForVerdict(hash);
      if (verdict.kind === "error") {
        setStatus({ phase: "error", message: verdict.reason, hash, action });
        return;
      }
      if (verdict.kind === "pending") {
        recheck.current = verify;
        setStatus({
          phase: "delayed",
          message: "Submitted — confirmation delayed. Check again re-reads the accepted state; do not send it twice.",
          hash, action,
        });
        return;
      }
      setStatus({ phase: "checking", message: "Executed. Reading the accepted state…", hash, action });
      const done = await verify();
      if (done) {
        setStatus({ phase: "success", message: done, hash, action });
      } else {
        recheck.current = verify;
        setStatus({
          phase: "delayed",
          message: "Executed, but the accepted state does not show the change yet. Check again in a moment.",
          hash, action,
        });
      }
    } catch (e) {
      setStatus({ phase: "error", message: errorMessage(e), action });
    } finally {
      setBusy(false);
    }
  }

  async function checkAgain() {
    const verify = recheck.current;
    if (!verify) return;
    setBusy(true);
    try {
      const done = await verify();
      if (done) {
        recheck.current = null;
        setStatus((s) => ({ ...s, phase: "success", message: done }));
      } else {
        setStatus((s) => ({ ...s, message: "The accepted state does not show the change yet. Try again shortly." }));
      }
    } catch (e) {
      setStatus((s) => ({ ...s, message: errorMessage(e) }));
    } finally {
      setBusy(false);
    }
  }

  async function onOpenJar() {
    if (!tip.ok || openReason) return;
    const id = jarId(me, title);
    const tipWei = tip.wei;
    const t = title;
    if (await getJar(id)) {
      setTitleTaken(true);
      return;
    }
    await runWrite("Open jar", "open_jar", [pyStrip(t), tipWei], 0n, async () => {
      const j = await getJar(id);
      if (!openVerified(j, { id, me, title: t, tipWei })) return null;
      setTitle("");
      setTipGen("");
      setJarIdLoaded(id);
      await loadJar(id);
      return `Jar opened, and the accepted state shows it: ${gen(tipWei)} per reply that means its praise. Share the link with readers.`;
    });
  }

  async function onReply() {
    if (!jar || !balances) return;
    // Probe the accepted state right before sending: the jar may have closed, or this wallet may already have replied.
    const [freshJar, freshReplies, freshBalances] = await Promise.all([getJar(jar.jar_id), getReplies(jar.jar_id), getBalances(me)]);
    if (!freshJar || !freshBalances) return;
    setJar(freshJar);
    setReplies(freshReplies);
    setBalances(freshBalances);
    const text = replyText;
    const bytes = calldataBytes("comment", [freshJar.jar_id, text]);
    const block = commentBlock({ jar: freshJar, me, replied: hasReplied(freshReplies, me), text, allowance: freshBalances.allowance, bytes });
    if (block) return;
    const before = { jar: freshJar, balances: freshBalances };
    await runWrite("Reply", "comment", [freshJar.jar_id, pyStrip(text)], 0n, async () => {
      const [j, r, b] = await Promise.all([getJar(freshJar.jar_id), getReplies(freshJar.jar_id), getBalances(me)]);
      const check = replyVerified(before, { jar: j, replies: r, balances: b }, me, text);
      if (!check.ok) return null;
      setJar(j);
      setReplies(r);
      setBalances(b);
      setReplyText("");
      setHighlight(check.reply.index);
      return movedTip(check.reply)
        ? `Validators read it as SINCERE_PRAISE. ${gen(check.reply.tip_moved)} moved from your allowance to the creator's earnings.`
        : "Validators read it as NOT_PRAISE. No GEN moved; your allowance is unchanged.";
    });
  }

  async function onClose() {
    if (!jar || closeReason) return;
    const id = jar.jar_id;
    await runWrite("Close jar", "close_jar", [id], 0n, async () => {
      const j = await getJar(id);
      if (!closeVerified(j)) return null;
      setJar(j);
      return "Jar closed, and the accepted state shows it. No further replies can be posted.";
    });
  }

  async function onFund() {
    if (!fund.ok || fundReason) return;
    const value = fund.wei;
    const before = await getBalances(me);
    await runWrite("Fund allowance", "fund_allowance", [], value, async () => {
      const after = await getBalances(me);
      if (!fundVerified(before, after, value)) return null;
      setBalances(after);
      setFundGen("");
      return `Allowance funded with ${gen(value)}. It is spent only when one of your replies is read as SINCERE_PRAISE.`;
    });
  }

  async function onWithdrawAllowance() {
    if (!wd.ok || withdrawReason) return;
    const amount = wd.wei;
    const before = await getBalances(me);
    await runWrite("Withdraw allowance", "withdraw_allowance", [amount], 0n, async () => {
      const after = await getBalances(me);
      if (!withdrawAllowanceVerified(before, after, amount)) return null;
      setBalances(after);
      setWithdrawGen("");
      return `${gen(amount)} sent back to your wallet; your allowance now reads ${gen(after!.allowance)}.`;
    });
  }

  async function onWithdrawEarnings() {
    if (earningsReason) return;
    const before = await getBalances(me);
    await runWrite("Withdraw earnings", "withdraw_earnings", [], 0n, async () => {
      const after = await getBalances(me);
      if (!withdrawEarningsVerified(before, after)) return null;
      setBalances(after);
      return `${gen(before!.earnings)} of earnings sent to your wallet; earnings now read 0 GEN.`;
    });
  }

  function onFind() {
    // A creator can also find their own jar again by its title: the id is derived from wallet + title.
    const id = jarIdFromInput(findInput) || (me && pyLen(pyStrip(findInput)) > 0 ? jarId(me, findInput) : "");
    if (!id) {
      setLoadError("Paste a 64-character jar id or a link that carries one, or connect the creator wallet and type the title");
      return;
    }
    setFindInput("");
    setJarIdLoaded(id);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setStatus({ phase: "success", message: "Link copied." });
    } catch {
      setStatus({ phase: "error", message: "Could not copy; copy the address bar instead." });
    }
  }

  // ---------- view ----------
  const sincereCount = jar?.praised_count ?? 0;
  const replyCount = jar?.reply_count ?? 0;
  const creatorIsMe = !!jar && isCreator(jar, me);

  return (
    <div className="page">
      <header className="topbar">
        <a className="brand" href="/" onClick={(e) => { e.preventDefault(); setJarIdLoaded(""); }}>
          <img src="/logo-192.png" alt="" width={32} height={32} />
          <span className="brand-name">Deadpan</span>
        </a>
        <p className="brand-line">Praise that means it pays the tip. Sarcasm keeps its money.</p>
        <div className="wallet">
          {me ? (
            <span className="wallet-chip" title={me}>
              <span className="dot" aria-hidden="true" />
              {short(me)}
            </span>
          ) : (
            <button className="btn btn-dark" onClick={connect}>Connect wallet</button>
          )}
        </div>
      </header>

      {!CONTRACT_ADDRESS && <p className="banner">This deployment has no contract address configured.</p>}

      <div className="layout">
        <main className="thread">
          <form className="finder" onSubmit={(e) => { e.preventDefault(); onFind(); }}>
            <input
              aria-label="Jar id or link"
              placeholder="Paste a jar link or id — or, as its creator, the jar title"
              value={findInput}
              onChange={(e) => setFindInput(e.target.value)}
              spellCheck={false}
            />
            <button className="btn btn-light" type="submit">Open</button>
          </form>

          {loading && <p className="muted">Reading the jar…</p>}
          {loadError && !loading && <p className="note-error">{loadError}</p>}

          {!jar && !loading && (
            <section className="card intro">
              <h1>One question about every reply</h1>
              <p>
                A creator posts a release and opens a tip jar. Readers pledge an allowance and reply. Validators read each
                reply once, with the release title, and decide one thing: is this praise meant as praise?
              </p>
              <ul className="intro-list">
                <li><span className="chip chip-sincere">SINCERE_PRAISE</span> the jar's tip moves from the writer's allowance to the creator.</li>
                <li><span className="chip chip-not">NOT_PRAISE</span> nothing moves — sarcasm, complaints and unclear replies cost nothing.</li>
                <li>Each wallet replies once per jar. The creator cannot reply to their own jar.</li>
              </ul>
              <p className="muted">Open a jar from the panel on the right, or paste a jar link above.</p>
            </section>
          )}

          {jar && (
            <>
              <article className="card post">
                <div className="post-head">
                  <span className={`state state-${jar.state.toLowerCase()}`}>{jar.state}</span>
                  <span className="muted mono" title={jar.creator}>
                    by {short(jar.creator)}{creatorIsMe ? " (you)" : ""}
                  </span>
                </div>
                <h1 className="post-title">{jar.title}</h1>
                <dl className="post-stats">
                  <div><dt>Tip per meant reply</dt><dd className="mono">{gen(jar.tip_wei)}</dd></div>
                  <div><dt>Replies that paid</dt><dd className="mono">{sincereCount} of {replyCount}</dd></div>
                  <div><dt>Tipped so far</dt><dd className="mono">{gen(jar.tipped_total)}</dd></div>
                </dl>
                <div className="post-actions">
                  <button className="btn btn-light" onClick={copyLink}>Copy link</button>
                  <span className="mono id" title={jar.jar_id}>jar {short(jar.jar_id, 10, 6)}</span>
                  {creatorIsMe && (
                    <span className="action">
                      <button className="btn btn-light" onClick={onClose} disabled={busy || !!closeReason}>Close jar</button>
                      {closeReason && <span className="reason">{closeReason}</span>}
                    </span>
                  )}
                </div>
              </article>

              <section className="card composer" aria-label="Reply">
                <label htmlFor="reply" className="composer-label">Reply</label>
                <textarea
                  id="reply"
                  rows={3}
                  placeholder="Say what you think of this release."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  disabled={busy}
                />
                <div className="composer-foot">
                  <span className={`meter ${replyBytes > CALLDATA_LIMIT ? "over" : ""}`}>
                    {pyLen(pyStrip(replyText))} / {MAX_COMMENT_LENGTH} characters · {replyBytes} / {CALLDATA_LIMIT} bytes
                  </span>
                  <span className="action">
                    {replyReason && <span className="reason">{replyReason}</span>}
                    <button className="btn btn-dark" onClick={onReply} disabled={busy || !!replyReason}>Reply</button>
                  </span>
                </div>
                <p className="fine">
                  If validators read your reply as SINCERE_PRAISE, {gen(jar.tip_wei)} moves from your allowance to the creator.
                  Otherwise nothing moves. You can reply to this jar once.
                </p>
              </section>

              <section className="replies" aria-label="Replies">
                <h2>{replyCount === 1 ? "1 reply" : `${replyCount} replies`}</h2>
                {replies.length === 0 && <p className="muted">No replies yet.</p>}
                {replies.map((r) => (
                  <article key={r.index} className={`card reply ${highlight === r.index ? "fresh" : ""}`}>
                    <div className="reply-head">
                      <span className="mono" title={r.author}>{short(r.author)}{r.author === me ? " (you)" : ""}</span>
                      <span className="muted">#{r.index + 1}</span>
                    </div>
                    <p className="reply-text">{r.text}</p>
                    <div className="reply-foot">
                      {r.outcome === "SINCERE_PRAISE" ? (
                        <span className="chip chip-sincere">SINCERE_PRAISE</span>
                      ) : (
                        <span className="chip chip-not">{r.outcome}</span>
                      )}
                      {movedTip(r) ? (
                        <span className="flow flow-yes">tip moved · {gen(r.tip_moved)} → creator</span>
                      ) : (
                        <span className="flow flow-no">no GEN moved</span>
                      )}
                    </div>
                  </article>
                ))}
              </section>
            </>
          )}
        </main>

        <aside className="rail">
          <section className="card">
            <h2>Your balances</h2>
            {!me && <p className="muted">Connect a wallet to see your allowance and earnings.</p>}
            {me && (
              <>
                <dl className="balances">
                  <div><dt>Allowance</dt><dd className="mono">{gen(balances?.allowance ?? "0")}</dd></div>
                  <div><dt>Earnings</dt><dd className="mono">{gen(balances?.earnings ?? "0")}</dd></div>
                </dl>
                <p className="fine">Both are held by the contract. Allowance is what you pledged for tips and have not spent; earnings are tips your jars received.</p>
              </>
            )}
            <div className="field">
              <label htmlFor="fund">Fund allowance (GEN)</label>
              <div className="row">
                <input id="fund" inputMode="decimal" placeholder="0.01" value={fundGen} onChange={(e) => setFundGen(e.target.value)} />
                <button className="btn btn-dark" onClick={onFund} disabled={busy || !!fundReason}>Fund</button>
              </div>
              {fundGen && (fund.ok ? fundReason && <span className="reason">{fundReason}</span> : <span className="reason">{fund.reason}</span>)}
            </div>
            <div className="field">
              <label htmlFor="wd">Withdraw allowance (GEN)</label>
              <div className="row">
                <input id="wd" inputMode="decimal" placeholder="0.01" value={withdrawGen} onChange={(e) => setWithdrawGen(e.target.value)} />
                <button className="btn btn-light" type="button" onClick={() => balances && setWithdrawGen(gen(balances.allowance).replace(" GEN", ""))} disabled={!balances}>Max</button>
                <button className="btn btn-dark" onClick={onWithdrawAllowance} disabled={busy || !!withdrawReason}>Withdraw</button>
              </div>
              {withdrawGen && (wd.ok ? withdrawReason && <span className="reason">{withdrawReason}</span> : <span className="reason">{wd.reason}</span>)}
            </div>
            <div className="field">
              <span className="action">
                <button className="btn btn-coin" onClick={onWithdrawEarnings} disabled={busy || !!earningsReason}>Withdraw earnings</button>
                {me && earningsReason && <span className="reason">{earningsReason}</span>}
              </span>
            </div>
          </section>

          <section className="card">
            <h2>Open a jar</h2>
            <div className="field">
              <label htmlFor="title">Release title</label>
              <input id="title" maxLength={400} placeholder="Release notes for version 1.2 of my app" value={title} onChange={(e) => setTitle(e.target.value)} />
              <span className="fine">{pyLen(pyStrip(title))} / {MAX_TITLE_LENGTH} characters</span>
            </div>
            <div className="field">
              <label htmlFor="tip">Tip per meant reply (GEN)</label>
              <input id="tip" inputMode="decimal" placeholder="0.001" value={tipGen} onChange={(e) => setTipGen(e.target.value)} />
              <span className="fine">Between 0.000001 and 1 GEN.</span>
            </div>
            {newJarId && <p className="fine mono">Jar id: {newJarId}</p>}
            <span className="action">
              <button className="btn btn-dark" onClick={onOpenJar} disabled={busy || !!openReason || !tip.ok}>Open jar</button>
              {(title || tipGen) && openShown && <span className="reason">{openShown}</span>}
            </span>
          </section>

          {status.phase !== "idle" && (
            <section className={`card status status-${status.phase}`} aria-live="polite">
              <h2>{status.action ?? "Status"}</h2>
              <p>{status.message}</p>
              {status.hash && (
                <a className="mono" href={`${EXPLORER_BASE}/tx/${status.hash}`} target="_blank" rel="noreferrer">
                  tx {short(status.hash, 10, 8)}
                </a>
              )}
              {status.phase === "delayed" && recheck.current && (
                <button className="btn btn-light" onClick={checkAgain} disabled={busy}>Check again</button>
              )}
            </section>
          )}
        </aside>
      </div>

      <footer className="foot">
        <span>Contract <a className="mono" href={`${EXPLORER_BASE}/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer">{short(CONTRACT_ADDRESS)}</a> on GenLayer StudioNet</span>
        <span>Validators decide; the app only mirrors rules the contract already enforces.</span>
      </footer>
    </div>
  );
}
