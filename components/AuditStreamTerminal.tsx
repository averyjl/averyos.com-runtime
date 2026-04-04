/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
import React, { useEffect, useState } from 'react';

interface AuditLogEntry {
  id: string;
  timestamp: string;
  event_type?: string;
  kernel_anchor?: string;
}

export const AuditStreamTerminal = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);

  useEffect(() => {
    const fetchLogs = async () => {
      const res = await fetch('/api/gatekeeper/logs'); // We will create this API route next
      const data = await res.json();
      setLogs(data);
    };
    const interval = setInterval(fetchLogs, 2000); // Pulse check every 2 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-black p-4 font-mono text-sm border-2 border-[#9d4edd] h-96 overflow-y-auto">
      <div className="text-[#9d4edd] mb-2">⛓️⚓⛓️ AVERYOS SYSTEM AUDIT STREAM [ACTIVE]</div>
      {logs.map((log: AuditLogEntry) => (
        <div key={log.id} className="text-[#c77dff] py-1 border-b border-[#3c096c]">
          <span className="text-gray-500">[{log.timestamp}]</span> 
          <span className="ml-2 font-bold">{log.event_type}</span>: 
          <span className="ml-2 italic">{log.kernel_anchor}</span>
        </div>
      ))}
    </div>
  );
};
