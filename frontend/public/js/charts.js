/**
 * PQlymarket - Chart Rendering (Client-Side)
 * Uses Chart.js for data visualization
 */

(function () {
  "use strict";

  /**
   * Initialize the volume chart on the home page
   */
  function initVolumeChart() {
    var canvas = document.getElementById("volumeChart");
    if (!canvas) return;

    var chartData = window.__VOLUME_CHART__;
    if (!chartData) return;

    var ctx = canvas.getContext("2d");

    // Create gradient fill
    var gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "rgba(255, 167, 41, 0.15)");
    gradient.addColorStop(1, "rgba(255, 167, 41, 0)");

    new Chart(ctx, {
      type: "line",
      data: {
        labels: chartData.labels,
        datasets: [
          {
            data: chartData.data,
            borderColor: "#ffa729",
            borderWidth: 2,
            backgroundColor: gradient,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHoverBackgroundColor: "#ffa729",
            pointHoverBorderColor: "#0e0e0e",
            pointHoverBorderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#1a1919",
            titleColor: "#ffffff",
            bodyColor: "#adaaaa",
            borderColor: "#494847",
            borderWidth: 1,
            padding: 12,
            displayColors: false,
            titleFont: { family: "Manrope", weight: "bold", size: 11 },
            bodyFont: { family: "Manrope", size: 10 },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: "#494847",
              font: { family: "Manrope", size: 8 },
              maxRotation: 0,
            },
            border: { display: false },
          },
          y: {
            grid: {
              color: "rgba(73, 72, 71, 0.1)",
              drawBorder: false,
            },
            ticks: { display: false },
            border: { display: false },
          },
        },
        interaction: {
          intersect: false,
          mode: "index",
        },
      },
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initVolumeChart);
  } else {
    initVolumeChart();
  }

  // Expose for manual re-init
  window.PQlyCharts = {
    initVolumeChart: initVolumeChart,
  };
})();
