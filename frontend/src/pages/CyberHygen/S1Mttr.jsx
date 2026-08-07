import React from 'react';

const S1Mttr = ({ total, mitigated }) => {
    console.log("S1Mttr props:", { total, mitigated });

    // Calculate the percentage
    const percentage = total > 0 ? (mitigated / total) * 100 : 0;
    const unmitigatedPercentage = 100 - percentage;
    const clampedPercentage = Math.min(Math.max(percentage, 0), 100);
    localStorage.setItem("s1Mttr", clampedPercentage.toFixed(0))
    // Calculate stroke dasharray for both portions
    const circumference = 219.8; // Arc length for semi-circle
    const greenDash = (clampedPercentage / 100) * circumference;
    const redDash = (unmitigatedPercentage / 100) * circumference;

    // Inline styles instead of Tailwind
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

                    {/* Green portion (mitigated) */}
                    <path
                        d="M 30 100 A 70 70 0 0 1 170 100"
                        fill="none"
                        stroke="#2ED573"
                        strokeWidth="16"
                        strokeLinecap="round"
                        strokeDasharray={`${greenDash} ${circumference}`}
                        opacity="1"
                    />

                    {/* Red portion (unmitigated) */}
                    <path
                        d="M 30 100 A 70 70 0 0 1 170 100"
                        fill="none"
                        stroke="#FF4757"
                        strokeWidth="16"
                        strokeLinecap="round"
                        strokeDasharray={`${redDash} ${circumference}`}
                        strokeDashoffset={`${-greenDash}`}
                        opacity="0.8"
                    />

                    {/* Center circle (pivot point) */}
                    <circle cx="100" cy="100" r="6" fill="#FFFFFF" />
                </svg>

                {/* Percentage Display */}
                <p style={percentageStyle}>{clampedPercentage.toFixed(0)}%</p>

                {/* Status Labels */}
                <div style={legendContainerStyle}>
                    <div style={legendItemStyle}>
                        <div style={legendCircleStyle('#2ED573')}></div>
                        <span style={legendTextStyle}>Mitigated ({mitigated})</span>
                    </div>
                    <div style={legendItemStyle}>
                        <div style={legendCircleStyle('#FF4757')}></div>
                        <span style={legendTextStyle}>Unmitigated ({total - mitigated})</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default S1Mttr;