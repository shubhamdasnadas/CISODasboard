import React from 'react';

const Ticketingmttr = ({ tickets }) => {
  // Calculate closed tickets
  const closedTickets = tickets.filter(t => ['Closed', 'Technically Closed', 'Resolved'].includes(t.status)).length;
  const total = tickets.length;
  const openTickets = total - closedTickets;
  
  console.log("Ticketingmttr props:", { total, closedTickets });
  
  // Calculate the percentage
  const percentage = total > 0 ? (closedTickets / total) * 100 : 0;
  const openPercentage = 100 - percentage;
  const clampedPercentage = Math.min(Math.max(percentage, 0), 100);
localStorage.setItem("ticketingMttr", clampedPercentage.toFixed(0))
  // Calculate stroke dasharray for both portions
  const circumference = 219.8; // Arc length for semi-circle
  const closedDash = (clampedPercentage / 100) * circumference;
  const openDash = (openPercentage / 100) * circumference;

  // Inline styles
  const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 16px',
    backgroundColor: '#0f172a',
    borderRadius: '8px',
    width: '100%',
    minHeight: 'auto'
  };

  const gaugeContainerStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    width: '100%'
  };

  const percentageStyle = {
    color: '#ffffff',
    fontSize: '36px',
    fontWeight: '600',
    textAlign: 'center',
    margin: '8px 0 0 0'
  };

  const statsStyle = {
    color: '#94a3b8',
    fontSize: '12px',
    textAlign: 'center',
    margin: '4px 0 0 0'
  };

  const legendContainerStyle = {
    display: 'flex',
    gap: '20px',
    marginTop: '8px',
    fontSize: '12px',
    justifyContent: 'center',
    flexWrap: 'wrap',
    width: '100%'
  };

  const legendItemStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  };

  const legendCircleStyle = (color) => ({
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: color
  });

  const legendTextStyle = {
    color: '#cbd5e1',
    fontSize: '11px'
  };

  return (
    <div style={containerStyle}>
      {/* Gauge Section */}
      <div style={gaugeContainerStyle}>
        <svg 
          width="240" 
          height="160" 
          viewBox="0 0 200 150" 
          style={{ filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))', display: 'block' }}
        >
          {/* Gauge background (dark gray track) */}
          <path
            d="M 30 100 A 70 70 0 0 1 170 100"
            fill="none"
            stroke="#1e293b"
            strokeWidth="16"
            strokeLinecap="round"
          />

          {/* Closed portion (blue) */}
          <path
            d="M 30 100 A 70 70 0 0 1 170 100"
            fill="none"
            stroke="#3B82F6"
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={`${closedDash} ${circumference}`}
            opacity="1"
          />

          {/* Open portion (orange) */}
          <path
            d="M 30 100 A 70 70 0 0 1 170 100"
            fill="none"
            stroke="#F97316"
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={`${openDash} ${circumference}`}
            strokeDashoffset={`${-closedDash}`}
            opacity="0.8"
          />

          {/* Center circle (pivot point) */}
          <circle cx="100" cy="100" r="6" fill="#FFFFFF" />
        </svg>

        {/* Percentage Display */}
        <p style={percentageStyle}>{clampedPercentage.toFixed(0)}%</p>
        
        {/* Stats Display */}
        <p style={statsStyle}>
          {closedTickets} of {total} tickets closed
        </p>

        {/* Status Labels */}
        {/* <div style={legendContainerStyle}>
          <div style={legendItemStyle}>
            <div style={legendCircleStyle('#3B82F6')}></div>
            <span style={legendTextStyle}>Closed ({clampedPercentage.toFixed(0)}%)</span>
          </div>
          <div style={legendItemStyle}>
            <div style={legendCircleStyle('#F97316')}></div>
            <span style={legendTextStyle}>Open ({openPercentage.toFixed(0)}%)</span>
          </div>
        </div> */}
      </div>
    </div>
  );
};

export default Ticketingmttr;