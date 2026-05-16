export default function Titlebar() {
  return (
    <div className="titlebar" data-testid="titlebar">
      <div className="tl-dots">
        <span className="tl-dot close" />
        <span className="tl-dot min" />
        <span className="tl-dot max" />
      </div>
      <div className="titlebar-title">
        gmc-shelters <em>— Archive Manager</em>
      </div>
    </div>
  );
}
