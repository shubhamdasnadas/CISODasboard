import api from '../../api';

export async function fetchReportData(orgName) {
  const safe = (promise) => promise.catch(() => null);

  const [
    threatsRes,
    agentsRes,
    cveRes,
    deviceRes,
    harmonyRes,
    fwWidgetsRes,
    fwRiskRes,
    fwAttackersRes,
    fwConnectionsRes,
    appAgentRes,
    removedAgentsRes,
    zohoRes,
  ] = await Promise.all([
    safe(api.get('/sentinelone/db/threats')),
    safe(api.get('/sentinelone/db/agents')),
    safe(api.get('/sentinelone/db/application-cve')),
    safe(api.get('/sentinelone/db/device-control')),
    safe(api.get('/harmony/events-db')),
    safe(api.get('/firewall/widgets')),
    safe(api.get('/firewall/reports/risk-trend')),
    safe(api.get('/firewall/reports/top-attacker-sources')),
    safe(api.get('/firewall/reports/top-connections')),
    safe(api.get('/sentinelone/db/application-agent')),
    safe(api.get('/sentinelone/db/agents/removed-count')),
    safe(api.get('/zoho/tickets-db')),
  ]);

  return {
    generatedAt: new Date(),
    orgName: orgName || 'Organisation',
    s1Threats:          threatsRes?.data?.threats  ?? [],
    s1Agents:           agentsRes?.data?.agents    ?? [],
    s1Cves:             cveRes?.data?.data ?? cveRes?.data?.cves ?? [],
    s1DeviceControl:    deviceRes?.data?.data      ?? [],
    harmonyEvents:      harmonyRes?.data?.events ?? harmonyRes?.data?.responseData ?? [],
    fwWidgets:          fwWidgetsRes?.data?.widgets ?? fwWidgetsRes?.data?.data ?? [],
    fwRiskRaw:          fwRiskRes?.data            ?? null,
    fwAttackersRaw:     fwAttackersRes?.data       ?? null,
    fwConnectionsRaw:   fwConnectionsRes?.data     ?? null,
    s1AppAgent:         appAgentRes?.data?.data    ?? [],
    removedAgentsCount: removedAgentsRes?.data?.count ?? 0,
    zohoTickets:        zohoRes?.data?.tickets     ?? [],
  };
}
