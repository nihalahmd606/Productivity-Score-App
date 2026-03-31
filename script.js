// State
const STORAGE_KEY = 'productivity_analytics_data';
let productivityData = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
let chartInstance = null;

// DOM Elements
const form = document.getElementById('metrics-form');
const dateInput = document.getElementById('date-input');
const tasksInput = document.getElementById('tasks-input');
const sleepInput = document.getElementById('sleep-input');
const screenInput = document.getElementById('screen-input');

const latestScoreDisplay = document.getElementById('latest-score');
const latestScoreBar = document.getElementById('latest-score-bar');
const avgScoreDisplay = document.getElementById('avg-score');
const keyInsightMsg = document.getElementById('key-insight-msg');
const bestDayText = document.getElementById('best-day-text');
const worstDayText = document.getElementById('worst-day-text');
const currentDateDisplay = document.getElementById('current-date');

const exportBtn = document.getElementById('export-btn');
const clearBtn = document.getElementById('clear-btn');

// Initialize
function init() {
    // Set current date in top right
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    currentDateDisplay.textContent = new Date().toLocaleDateString('en-US', options);
    
    // Set default value for date picker
    dateInput.valueAsDate = new Date();

    Chart.defaults.color = '#94a3b8';
    Chart.defaults.font.family = "'Outfit', sans-serif";
    
    updateDashboard();
}

// Logic to Calculate Score
function calculateScore(tasks, sleep, screenTime) {
    // Basic Weighting
    // Tasks: +10 pts each
    // Sleep: +5 pts per hour (optimal 8 = 40)
    // Screen Time: -3 pts per hour 
    
    let rawScore = (tasks * 10) + (sleep * 5) - (screenTime * 3);
    
    // Let's normalize it to a 0-100 scale using an empirical cap.
    // Assume a "perfect" day is: 10 tasks (100) + 8 hours sleep (40) - 2 hours screen (6) = 134.
    const maxScore = 134; 
    let normalized = (rawScore / maxScore) * 100;
    
    // Clamp between 0 and 100
    if (normalized > 100) normalized = 100;
    if (normalized < 0) normalized = 0;
    
    return Math.round(normalized);
}

// Form Submission Handler
form.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const dateStr = dateInput.value; // YYYY-MM-DD
    const tasks = parseInt(tasksInput.value, 10);
    const sleep = parseFloat(sleepInput.value);
    const screenTime = parseFloat(screenInput.value);
    
    const score = calculateScore(tasks, sleep, screenTime);
    
    const newEntry = {
        date: dateStr,
        tasks,
        sleep,
        screenTime,
        score
    };

    // Replace if date exists, otherwise add
    const existingIndex = productivityData.findIndex(d => d.date === dateStr);
    if (existingIndex !== -1) {
        productivityData[existingIndex] = newEntry;
    } else {
        productivityData.push(newEntry);
    }
    
    // Sort chronologically
    productivityData.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Save & Update UI
    saveData();
    updateDashboard();

    // Small animation effect on UI
    latestScoreDisplay.style.transform = 'scale(1.2)';
    latestScoreDisplay.style.color = 'var(--accent-primary)';
    setTimeout(() => {
        latestScoreDisplay.style.transform = 'scale(1)';
        latestScoreDisplay.style.color = 'var(--text-main)';
    }, 300);
});

// Update entire dashboard UI
function updateDashboard() {
    if (productivityData.length === 0) {
        resetDashboardUI();
        return;
    }

    const latestEntry = productivityData[productivityData.length - 1];
    
    // 1. Current Score
    latestScoreDisplay.textContent = latestEntry.score;
    latestScoreBar.style.width = `${latestEntry.score}%`;
    
    // Color bar based on score 
    if(latestEntry.score < 40) {
        latestScoreBar.style.background = 'linear-gradient(90deg, #ef4444, #f97316)'; // Red-Orange
    } else if (latestEntry.score < 70) {
        latestScoreBar.style.background = 'linear-gradient(90deg, #eab308, #f59e0b)'; // Yellow
    } else {
        latestScoreBar.style.background = 'linear-gradient(90deg, #10b981, #3b82f6)'; // Green-Blue
    }

    // 2. Average Score
    const totalScore = productivityData.reduce((acc, curr) => acc + curr.score, 0);
    const avg = Math.round(totalScore / productivityData.length);
    avgScoreDisplay.textContent = avg;

    // 3. Best / Worst Days
    let best = productivityData[0];
    let worst = productivityData[0];

    productivityData.forEach(d => {
        if (d.score > best.score) best = d;
        if (d.score < worst.score) worst = d;
    });

    const formatDate = (str) => new Date(str).toLocaleDateString('en-US', {month:'short', day:'numeric'});
    
    bestDayText.innerHTML = `${formatDate(best.date)} <span style="color:var(--text-muted);font-size:0.9rem;">(${best.score})</span>`;
    worstDayText.innerHTML = `${formatDate(worst.date)} <span style="color:var(--text-muted);font-size:0.9rem;">(${worst.score})</span>`;

    // 4. Generate Key Insight
    generateInsight(latestEntry, avg);

    // 5. Update Chart
    renderChart();
}

function generateInsight(latest, avg) {
    let msg = "";
    
    if (latest.sleep < 6) {
        msg = "Lack of sleep (<6h) is heavily degrading your focus potential today.";
    } else if (latest.screenTime > 8) {
        msg = "High screen time! Remember to take physical breaks to prevent burnout.";
    } else if (latest.tasks > 8) {
        msg = "Stellar task output! You're in a peak flow state.";
    } else if (latest.score > avg) {
        msg = "You're performing above your average. Keep the momentum going!";
    } else if (latest.score < avg) {
        msg = "Score dips are normal. Try tackling a small, quick task to build momentum.";
    } else {
        msg = "Consistent performance. Stay hydrated and stick to your routine.";
    }

    keyInsightMsg.textContent = msg;
}

function renderChart() {
    const ctx = document.getElementById('trendsChart').getContext('2d');
    
    // Get last 14 days maximum
    const displayData = productivityData.slice(-14);
    const labels = displayData.map(d => new Date(d.date).toLocaleDateString('en-US', {month:'short', day:'numeric'}));
    const dataPoints = displayData.map(d => d.score);

    if (chartInstance) {
        chartInstance.destroy();
    }

    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)'); // Blue
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Productivity Score',
                data: dataPoints,
                borderColor: '#3b82f6',
                backgroundColor: gradient,
                borderWidth: 3,
                pointBackgroundColor: '#8b5cf6',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: '#8b5cf6',
                pointRadius: 4,
                pointHoverRadius: 6,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#fff',
                    bodyColor: '#cbd5e1',
                    padding: 12,
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    displayColors: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#94a3b8'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#94a3b8',
                        maxRotation: 45,
                        minRotation: 0
                    }
                }
            }
        }
    });
}

function resetDashboardUI() {
    latestScoreDisplay.textContent = "--";
    latestScoreBar.style.width = "0%";
    avgScoreDisplay.textContent = "--";
    bestDayText.textContent = "No data";
    worstDayText.textContent = "No data";
    keyInsightMsg.textContent = "Log your first day's metrics to unlock insights.";
    
    if (chartInstance) chartInstance.destroy();
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(productivityData));
}

// Action Buttons
exportBtn.addEventListener('click', () => {
    if (productivityData.length === 0) return alert("No data to export!");

    // Build CSV
    const headers = ["Date", "Tasks", "Sleep Hours", "Screen Time Hours", "Score"];
    const rows = productivityData.map(d => [d.date, d.tasks, d.sleep, d.screenTime, d.score]);
    
    let csvContent = "data:text/csv;charset=utf-8," 
        + headers.join(",") + "\n" 
        + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "productivity_data.csv");
    document.body.appendChild(link); // Required for FF
    
    link.click();
    link.remove();
});

clearBtn.addEventListener('click', () => {
    if(confirm("Are you sure you want to permanently delete all your data?")) {
        productivityData = [];
        saveData();
        updateDashboard();
    }
});

// Run Init
init();
