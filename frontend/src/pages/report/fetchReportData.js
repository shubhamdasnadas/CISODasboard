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
  ]);

  return {
    generatedAt: new Date(),
    orgName: orgName || 'Organisation',
    s1Threats:       threatsRes?.data?.threats       ?? threatsRes?.data       ?? [],
    s1Agents:        agentsRes?.data?.agents         ?? agentsRes?.data        ?? [],
    s1Cves:          cveRes?.data?.cves              ?? cveRes?.data           ?? [],
    s1DeviceControl: deviceRes?.data?.deviceControl  ?? deviceRes?.data        ?? [],
    harmonyEvents:   harmonyRes?.data?.events        ?? harmonyRes?.data       ?? [],
    fwWidgets:       fwWidgetsRes?.data?.widgets     ?? fwWidgetsRes?.data     ?? [],
    fwRiskRaw:       fwRiskRes?.data                 ?? null,
    fwAttackersRaw:  fwAttackersRes?.data            ?? null,
    fwConnectionsRaw:fwConnectionsRes?.data          ?? null,
  };
}
