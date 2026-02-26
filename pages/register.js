import React, { useState } from 'react';

export default function WitnessRegister() {
  const [handle, setHandle] = useState('');
  const [email, setEmail] = useState('');
  const [hashInput, setHashInput] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/witness/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: handle, email, vaultSig: hashInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? 'Submission failed. Please try again.');
      } else {
        setSubmitted(true);
      }
    } catch {
      setSubmitError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
      <h1>⛓️⚓⛓️ Witness Register</h1>
      <p>By registering, you anchor your truth to the AveryOS Sovereign Mesh.</p>
      {submitted ? (
        <p style={{ color: 'green', fontWeight: 'bold' }}>✅ Committed to VaultChain.</p>
      ) : (
        <form onSubmit={handleSubmit}>
          <label>Public Handle / Hardware ID:</label><br/>
          <input type="text" placeholder="AVERY-SIG-..." value={handle} onChange={(e) => setHandle(e.target.value)} required /><br/><br/>
          <label>Email Address:</label><br/>
          <input type="email" placeholder="witness@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required /><br/><br/>
          <label>Evidence Cluster Hash (SHA-512):</label><br/>
          <input type="text" placeholder="SHA512..." value={hashInput} onChange={(e) => setHashInput(e.target.value)} required /><br/><br/>
          {submitError && <p style={{ color: 'red' }}>⚠️ {submitError}</p>}
          <button type="submit" disabled={submitting}>{submitting ? 'Committing…' : 'COMMIT TO VAULTCHAIN'}</button>
        </form>
      )}
    </div>
  );
}
