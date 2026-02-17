import React from 'react'
import ReactDOM from 'react-dom/client'

const App = () => (
  <div>
    <h1>🔐 VaultEcho Viewer Activated</h1>
    <p>This is the persistent viewer interface for VaultEcho capsule traces.</p>
  </div>
)

ReactDOM.createRoot(document.getElementById('root')).render(<App />)
