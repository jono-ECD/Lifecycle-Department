// PIN prompt for reviewers who have one. Posts to /api/reviewer/pin with either the personal token or an email signature.
export function PinForm({ field, value, workspaceName, error }: { field: 'token' | 'sig'; value: string; workspaceName: string; error?: boolean }) {
  return (
    <div className="app">
      <form className="pinbox" method="post" action="/api/reviewer/pin">
        <h1>Campaign Bank</h1>
        <p className="muted" style={{ margin: 0 }}>
          Enter your 4 digit PIN to open the {workspaceName} bank.
        </p>
        {error && <div className="err">That PIN did not match.</div>}
        <input type="hidden" name={field} value={value} />
        <input name="pin" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} autoComplete="one-time-code" autoFocus required />
        <button className="btn primary" type="submit">
          Open
        </button>
      </form>
    </div>
  );
}
