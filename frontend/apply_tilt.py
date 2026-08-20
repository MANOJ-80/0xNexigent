import re

with open('src/pages/Dashboard.tsx', 'r') as f:
    content = f.read()

# Replace <div className="panel"> to <TiltCard className="panel"> in the overview section
content = content.replace(
'''          <section className="grid top">
            <div className="panel">
              <p className="tag">&lt; BUDGET UTILISATION &gt;</p>
              <h2>Every scope must fit.</h2>
              {data.budgets.slice(0, 6).map((b) => (
                <div className="budget" key={b.id}>
                  <div>
                    <span>{b.scope.toUpperCase()} BUDGET</span>
                    <strong>
                      {money(b.spent)} / {money(b.limit)}
                    </strong>
                  </div>
                  <div className="bar-bg">
                    <div className={`bar-fill ${state((b.spent / b.limit) * 100)}`} style={{ width: `${Math.min((b.spent / b.limit) * 100, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="panel">
              <p className="tag">&lt; REQUEST VOLUME &gt;</p>
              <h2>Throughput & Scale</h2>
              <div className="stat-group">
                <div className="stat">
                  <span>TOTAL PROCESSED</span>
                  <strong>{data.metrics.total_requests.toLocaleString()}</strong>
                </div>
                <div className="stat">
                  <span>FALLBACKS & REROUTES</span>
                  <strong className="amber">{data.metrics.reroutes.toLocaleString()}</strong>
                </div>
                <div className="stat">
                  <span>HARD BLOCKED</span>
                  <strong className="red">{data.metrics.blocked.toLocaleString()}</strong>
                </div>
              </div>
            </div>
          </section>''', 
'''          <section className="grid top">
            <TiltCard className="panel">
              <p className="tag">&lt; BUDGET UTILISATION &gt;</p>
              <h2>Every scope must fit.</h2>
              {data.budgets.slice(0, 6).map((b) => (
                <div className="budget" key={b.id}>
                  <div>
                    <span>{b.scope.toUpperCase()} BUDGET</span>
                    <strong>
                      {money(b.spent)} / {money(b.limit)}
                    </strong>
                  </div>
                  <div className="bar-bg">
                    <div className={`bar-fill ${state((b.spent / b.limit) * 100)}`} style={{ width: `${Math.min((b.spent / b.limit) * 100, 100)}%` }} />
                  </div>
                </div>
              ))}
            </TiltCard>

            <TiltCard className="panel">
              <p className="tag">&lt; REQUEST VOLUME &gt;</p>
              <h2>Throughput & Scale</h2>
              <div className="stat-group">
                <div className="stat">
                  <span>TOTAL PROCESSED</span>
                  <strong>{data.metrics.total_requests.toLocaleString()}</strong>
                </div>
                <div className="stat">
                  <span>FALLBACKS & REROUTES</span>
                  <strong className="amber">{data.metrics.reroutes.toLocaleString()}</strong>
                </div>
                <div className="stat">
                  <span>HARD BLOCKED</span>
                  <strong className="red">{data.metrics.blocked.toLocaleString()}</strong>
                </div>
              </div>
            </TiltCard>
          </section>'''
)

# Login Page fixes
with open('src/pages/Login.tsx', 'r') as f:
    login = f.read()

login = login.replace(
    "<div className=\"panel\" style={{ padding: '40px' }}>",
    "<div className=\"panel spotlight-card animated-border\" style={{ padding: '40px' }}>"
)
login = login.replace(
    "<h2>Gateway Authentication</h2>",
    "<h2><span className=\"text-gradient\">Gateway Authentication</span></h2>"
)
login = login.replace(
    "<button type=\"submit\" disabled={loading} style={{ marginTop: '12px', padding: '14px', fontSize: '14px' }}>",
    "<button type=\"submit\" disabled={loading} className=\"animated-border\" style={{ marginTop: '12px', padding: '14px', fontSize: '14px', border: 'none' }}>\n              <span style={{ position: 'relative', zIndex: 2 }}>"
)
login = login.replace(
    "{loading ? 'AUTHENTICATING...' : 'ESTABLISH SECURE SESSION'}\n            </button>",
    "{loading ? 'AUTHENTICATING...' : 'ESTABLISH SECURE SESSION'}\n              </span>\n            </button>"
)

with open('src/pages/Dashboard.tsx', 'w') as f:
    f.write(content)

with open('src/pages/Login.tsx', 'w') as f:
    f.write(login)

print("Applied Dashboard and Login fixes")
