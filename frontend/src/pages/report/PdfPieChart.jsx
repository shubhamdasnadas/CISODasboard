import { useEffect, useRef } from 'react';
import { Chart as ChartJS, ArcElement, DoughnutController, PieController, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, DoughnutController, PieController, Tooltip, Legend);

// Canvas-based pie/donut chart. Recharts' SVG <PieChart> relies on
// auto-generated clipPath ids to mask each arc; those ids collide once
// html-to-image serializes multiple pie charts on the same page into a
// single SVG for rasterization, so slices render blank/solid in the PDF
// even though they look fine on screen. Chart.js draws directly to a
// <canvas> bitmap, so there's no clipPath/SVG step for html-to-image to
// mangle.
export function PdfPieChart({ data, width = 260, height = 220, donut = true, legend = true }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current?.destroy();

    chartRef.current = new ChartJS(canvasRef.current, {
      type: donut ? 'doughnut' : 'pie',
      data: {
        labels: data.map(d => d.name),
        datasets: [{
          data: data.map(d => d.value),
          backgroundColor: data.map(d => d.fill),
          borderColor: '#fff',
          borderWidth: 1,
        }],
      },
      options: {
        responsive: false,
        animation: false,
        cutout: donut ? '55%' : 0,
        plugins: {
          legend: {
            display: legend,
            position: 'bottom',
            labels: { boxWidth: 10, font: { size: 11 }, color: '#374151' },
          },
          tooltip: { enabled: false },
        },
      },
    });

    return () => chartRef.current?.destroy();
  }, [data, width, height, donut, legend]);

  return <canvas ref={canvasRef} width={width} height={height} style={{ display: 'block', margin: '0 auto' }} />;
}
