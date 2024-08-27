let port;
let reader;
let outputStream;
let inputStream;
let dataBuffer = [];
let incompleteLine = '';
let headerPrinted = false;
let resetCount = 0;
let fullLogData = '';

const timeData = [];
const doseRateData = [];
const accumulatedDoseData = [];
const deadtimeData = [];
const countsPerSecondData = [];
const batteryData = [];

const consoleWindow = document.getElementById('console-window');

function log(message) {
    console.log(message);
    consoleWindow.innerHTML += message + '<br>';
    consoleWindow.scrollTop = consoleWindow.scrollHeight;
}

// Custom plugin to draw a border around the chart area
const chartAreaBorderPlugin = {
    id: 'chartAreaBorder',
    beforeDraw(chart) {
        const { ctx, chartArea: { left, top, width, height } } = chart;
        ctx.save();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.strokeRect(left, top, width, height);
        ctx.restore();
    }
};

const createChart = (ctx, label, data, borderColor, backgroundColor, yAxisLabel) => {
    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: timeData,
            datasets: [{
                label: label,
                data: data,
                borderColor: borderColor,
                backgroundColor: backgroundColor,
                fill: true,
                pointRadius: 0
            }]
        },
        options: {
            aspectRatio: 5,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Time (s) since logging started'
                    },
                    grid: {
                        display: false
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: yAxisLabel
                    },
                    grid: {
                        display: false
                    }
                }
            },
            plugins: {
                zoom: {
                    zoom: {
                        wheel: { enabled: true },
                        pinch: { enabled: true },
                        mode: 'x',
                    },
                    pan: {
                        enabled: true,
                        mode: 'x',
                    }
                },
                chartAreaBorder: true,
                annotation: {
                    annotations: {
                        powerOnOffLines: {
                            type: 'line',
                            scaleID: 'x',
                            borderColor: 'black',
                            borderWidth: 2,
                            label: {
                                content: 'Power on/off',
                                enabled: true,
                                position: 'top'
                            },
                            value: null,
                            display: false
                        }
                    }
                }
            }
        },
        plugins: [chartAreaBorderPlugin]
    });
};

log('Initializing charts...');
const doseRateChart = createChart(
    document.getElementById('dose-rate-chart').getContext('2d'),
    'Dose Rate',
    doseRateData,
    'red',
    'rgba(255, 0, 0, 0.3)',
    'uSv/h'
);

const accumulatedDoseChart = createChart(
    document.getElementById('accumulated-dose-chart').getContext('2d'),
    'Total Dose',
    accumulatedDoseData,
    'blue',
    'rgba(0, 0, 255, 0.3)',
    'uSv'
);

const deadtimeChart = createChart(
    document.getElementById('deadtime-chart').getContext('2d'),
    'Deadtime',
    deadtimeData,
    'green',
    'rgba(0, 255, 0, 0.3)',
    '%'
);

const countsPerSecondChart = createChart(
    document.getElementById('counts-per-second-chart').getContext('2d'),
    'Counts Per Second',
    countsPerSecondData,
    'orange',
    'rgba(255, 165, 0, 0.3)',
    'Counts'
);

const batteryChart = createChart(
    document.getElementById('battery-chart').getContext('2d'),
    'Battery',
    batteryData,
    'purple',
    'rgba(128, 0, 128, 0.3)',
    '%'
);
log('Charts initialized.');

document.getElementById('connect-button').addEventListener('click', async () => {
    log('Connect button clicked. Attempting to connect...');
    if ('serial' in navigator) {
        try {
            port = await navigator.serial.requestPort();
            await port.open({ baudRate: 115200 });
            log('Serial port opened successfully.');

            const textEncoder = new TextEncoderStream();
            outputStream = textEncoder.writable;
            const writableStreamClosed = textEncoder.readable.pipeTo(port.writable);

            const textDecoder = new TextDecoderStream();
            inputStream = textDecoder.readable;
            const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);

            reader = inputStream.getReader();
            
            document.getElementById('print-log-button').disabled = false;
            document.getElementById('download-button').disabled = false;
            document.getElementById('download-pdf-button').disabled = false;
            log('All buttons enabled. Ready to receive data.');

        } catch (error) {
            console.error('Error:', error);
            log('Failed to connect: ' + error.message);
            alert('Failed to connect: ' + error.message);
        }
    } else {
        console.error('Web Serial API not supported.');
        log('Web Serial API not supported. Please use Chrome or Edge.');
        alert('Web Serial API is not supported in this browser. Please use Chrome or Edge.');
    }
});

document.getElementById('print-log-button').addEventListener('click', async () => {
    log('Print Log button clicked. Clearing graphs...');
    clearGraphs();
    if (outputStream) {
        const writer = outputStream.getWriter();
        log('Sending "P" command to Pico...');
        await writer.write('P\n');
        writer.releaseLock();
        
        log('Waiting for the entire log to be printed...');
        try {
            fullLogData = await readFullLog(); // Store the full log data
            log('Full log received. Processing data...');
            processData(fullLogData);
            log('Data processing complete.');
        } catch (error) {
            log('Error reading full log: ' + error.message);
            console.error('Error reading full log:', error);
        }
    }
});

document.getElementById('clear-button').addEventListener('click', () => {
    log('Clear button clicked. Clearing all data and updating charts...');
    clearData();
    updateCharts();
    log('Data cleared and charts updated.');
});

document.getElementById('download-button').addEventListener('click', () => {
    log('Download CSV button clicked. Preparing CSV file...');
    
    if (!fullLogData) {
        log('No data available. Please print log first.');
        return;
    }
    
    const { resetPoints } = processData(fullLogData);
    
    const csvRows = [
        ['Time', 'Dose Rate (uSv/h)', 'Total Dose (uSv)', 'Deadtime (%)', 'Counts Per Second', 'Battery (%)']
    ];

    timeData.forEach((time, index) => {
        if (resetPoints.includes(time)) {
            csvRows.push(['DEVICE_RESET']);
        }
        csvRows.push([
            time,
            doseRateData[index],
            accumulatedDoseData[index],
            deadtimeData[index],
            countsPerSecondData[index],
            batteryData[index]
        ]);
    });

    const csvContent = csvRows.map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'datalog.csv';
    a.click();
    URL.revokeObjectURL(url);
    log('CSV file downloaded.');
});

document.getElementById('download-pdf-button').addEventListener('click', async () => {
    log('Download PDF button clicked. Generating vector PDF...');

    if (timeData.length === 0) {
        log('No data available. Please print log first.');
        return;
    }

    const pdf = new jspdf.jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.width;
    const pageHeight = pdf.internal.pageSize.height;
    const margin = 10;
    const chartWidth = pageWidth - 2 * margin;
    const chartHeight = 50;

    // Add title
    pdf.setFontSize(16);
    pdf.text('Open Dosimeter Log', pageWidth / 2, 20, { align: 'center' });

    // Function to add a chart to the PDF
    async function addChartToPDF(chart, title, yPos) {
        pdf.setFontSize(12);
        pdf.text(title, margin, yPos);

        // Create an SVG element from the chart
        const svg = chart.toBase64Image();
        const image = new Image();
        image.src = svg;
        await new Promise(resolve => {
            image.onload = () => {
                pdf.addImage(image, 'PNG', margin, yPos + 5, chartWidth, chartHeight);
                resolve();
            };
        });
    }

    // Add charts
    let yPosition = 30;
    await addChartToPDF(doseRateChart, 'Dose Rate (µSv/h)', yPosition);
    yPosition += chartHeight + 20;

    if (yPosition + chartHeight + 20 > pageHeight) {
        pdf.addPage();
        yPosition = 20;
    }
    await addChartToPDF(accumulatedDoseChart, 'Accumulated Dose (µSv)', yPosition);
    yPosition += chartHeight + 20;

    if (yPosition + chartHeight + 20 > pageHeight) {
        pdf.addPage();
        yPosition = 20;
    }
    await addChartToPDF(deadtimeChart, 'Deadtime (%)', yPosition);
    yPosition += chartHeight + 20;

    if (yPosition + chartHeight + 20 > pageHeight) {
        pdf.addPage();
        yPosition = 20;
    }
    await addChartToPDF(countsPerSecondChart, 'Counts Per Second', yPosition);
    yPosition += chartHeight + 20;

    if (yPosition + chartHeight + 20 > pageHeight) {
        pdf.addPage();
        yPosition = 20;
    }
    await addChartToPDF(batteryChart, 'Battery (%)', yPosition);

    pdf.save('open_dosimeter_log_vector.pdf');
    log('Vector PDF file downloaded.');
});


async function readFullLog() {
    let fullLog = '';
    let done = false;
    const timeout = 30000; // 30 seconds timeout
    const startTime = Date.now();

    while (!done) {
        try {
            const { value, done: readerDone } = await Promise.race([
                reader.read(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout))
            ]);

            if (readerDone) {
                done = true;
            } else if (value) {
                fullLog += value;
                if (value.includes('END_OF_LOG')) {
                    done = true;
                }
            }

            if (Date.now() - startTime > timeout) {
                console.warn('Reading log timed out');
                done = true;
            }
        } catch (error) {
            console.error('Error reading from serial port:', error);
            done = true;
        }
    }
    
    return fullLog;
}

function clearGraphs() {
    clearData();
    updateCharts();
}

function clearData() {
    dataBuffer = [];
    incompleteLine = '';
    headerPrinted = false;
    resetCount = 0;
    timeData.length = 0;
    doseRateData.length = 0;
    accumulatedDoseData.length = 0;
    deadtimeData.length = 0;
    countsPerSecondData.length = 0;
    batteryData.length = 0;
}

function updateCharts() {
    log('Updating charts...');
    doseRateChart.update();
    accumulatedDoseChart.update();
    deadtimeChart.update();
    countsPerSecondChart.update();
    batteryChart.update();
    log('Charts updated.');
}

function processData(fullLog) {
    const lines = fullLog.split('\n');
    timeData.length = 0;
    doseRateData.length = 0;
    accumulatedDoseData.length = 0;
    deadtimeData.length = 0;
    countsPerSecondData.length = 0;
    batteryData.length = 0;
    
    let timeCounter = 0;
    let resetPoints = [];

    lines.forEach(line => {
        if (line.trim() === 'DEVICE_RESET') {
            resetPoints.push(timeCounter);

            // Insert null values to create gaps
            timeData.push(null);
            doseRateData.push(null);
            accumulatedDoseData.push(null);
            deadtimeData.push(null);
            countsPerSecondData.push(null);
            batteryData.push(null);
        } else if (line.trim() && !line.startsWith('CurrentDoseRate') && line !== 'END_OF_LOG') {
            const [currentDoseRate, totalAccumulatedDose, deadtime, countsPerSecond, battery] = line.split(',').map(Number);

            timeData.push(timeCounter);
            doseRateData.push(currentDoseRate / 1000); // Convert nSv/h to µSv/h
            accumulatedDoseData.push(totalAccumulatedDose / 1000); // Convert nSv to µSv
            deadtimeData.push(deadtime);
            countsPerSecondData.push(countsPerSecond);
            batteryData.push(battery);

            timeCounter++;
        }
    });

    // Update all charts
    updateCharts();

    return { resetPoints, timeData, doseRateData, accumulatedDoseData, deadtimeData, countsPerSecondData, batteryData };
}
