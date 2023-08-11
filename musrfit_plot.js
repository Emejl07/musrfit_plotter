// Variables to store data and column selections
let dataLoaded = false; // Indicates if data has been loaded
let data = []; // Array to store the loaded data
let header = [];
let numColumns;
let errorBarChange = false;
let resizeTimeout;
//let plotDivIDs = []; // is this being used?

// Define a variable to store the plot instance
let plotInstance;
let savePlot;

const tableDiv = document.getElementById("tableDiv");
const plotDivContainer = document.getElementById('plotDivContainer');

let nPlots = (localStorage.getItem("nPlots") != null) ? localStorage.getItem("nPlots") : 1;
let plotDivCount = 1;
let plotInstances = {};
let savePlots = {};  // Store references to plot instances

class TraceConfig {
  constructor(xData, yData, n_yCol, mode, lineShape, type, showErrors, errorData = null, color = null) {
    this.xData = xData;
    this.yData = yData;
    this.n_yCol = n_yCol;
    this.mode = mode;
    this.type = type;
    this.lineShape = lineShape;
    this.showErrors = showErrors;
    this.errorData = errorData;
    this.color = color;
  }

  getTrace() {
    let trace = {
      x: this.xData,
      y: this.yData,
      mode: this.mode,
      type: this.type,
      name: header[this.n_yCol],
      line: { shape: this.lineShape },
    };
    if (this.showErrors && this.errorData) {
      trace.error_y = {
        type: 'data',
        array: this.errorData,
        visible: true,
      };
    }

    if (this.color) {
      trace.line = {
        color: this.color,
      };
    }
    return trace;
  }
}

// Event listener for file input to handle loading data
document.getElementById("fileInput").addEventListener("change", handleLocalFile);
const url = window.location.search;
const urlParams = new URLSearchParams(url);
// Get file name from url if present (files from web server)
const file = urlParams.get('file')
if (file) handleFile(file);

// Function to handle loading data from webserver
async function handleFile(file) {
  // Fetch the file from the server
  const response = await fetch(file);
  if (response.status != 200) {
    // did not succeed for some reason
    alert('The file cannot be found/loaded!');
    return;
  }
  const contents = await response.text();
  data = parseData(contents.trim()); // Parse the data from the file
  // When the file is loaded, process its contents
  createTable(data); // Display the data as a table
  dataLoaded = true; // Set dataLoaded flag to true

  // Show the table and plot divs and the add button
  tableDiv.style.display = "block";
  document.getElementById("addPlotButton").style.display = "block";
  // reproduce all plots
  for (let i = 1; i <= nPlots; i++) {
    addPlotDiv();
  }
}

// Function to handle loading data from file
function handleLocalFile(e) {
  // Get the file from the input
  const file = e.target.files[0];
  const reader = new FileReader();

  reader.onload = function (e) {
    // When the file is loaded, process its contents
    const contents = e.target.result;
    data = parseData(contents.trim()); // Parse the data from the file
    createTable(data); // Display the data as a table
    dataLoaded = true; // Set dataLoaded flag to true

    // Show the table and plot divs and the add button
    tableDiv.style.display = "block";
    document.getElementById("addPlotDivButton").style.display = "block";
    // reproduce all plots
    for (let i = 1; i <= nPlots; i++) {
      addPlotDiv();
    }
  };
  reader.readAsText(file); // Read the file as text
}

// Function to parse the data from the ascii file contents
function parseData(contents) {
  const lines = contents.split("\n");
  numColumns = lines[1].trim().split(/\s+/).length;
  const data = new Array(numColumns).fill(null).map(() => []);
  for (let i = 0; i < lines.length; i++) {
    const columns = lines[i].trim().split(/\s+/);
    for (let j = 0; j < numColumns; j++) {
      if (i == 0) {
        header = columns.map(str => str.toString().replace(/[%,\s]/g, '')).filter(Boolean);
        data[j].push(header[j]);
      }
      else data[j].push(parseFloat(columns[j]));
    }
  }
  return data;
}

// Function to create the table from the loaded data
function createTable(data) {
  tableDiv.innerHTML = "";

  const table = document.createElement("table");
  table.className = "dataTable";
  for (let i = 0; i < data[0].length; i++) {
    const tableRow = document.createElement("tr");

    for (const column of data) {
      const tableCell = document.createElement("td");
      tableCell.textContent = column[i];
      tableRow.appendChild(tableCell);
    }
    table.appendChild(tableRow);
  }
  tableDiv.appendChild(table);
}

// Function to reset the file input and clear selections
function resetFileInput(ID) {
  if (ID) {
    ID_number = parseNumberFromID(ID);
    // Clear the selection menus when the file input is reset
    const xSelect = document.getElementById("xSelect" + ID_number);
    const ySelect = document.getElementById("ySelect" + ID_number);
    const errorSelect = document.getElementById("errorSelect" + ID_number);
    if (xSelect) xSelect.innerHTML = "";
    if (yselect) ySelect.innerHTML = "";
    if (errorSelect) errorSelect.innerHTML = "";
  }
  nPlots = 1;
  plotDivCount = 1;
  localStorage.setItem("nPlots", nPlots);
  // Clear local storage
  localStorage.clear();

  dataLoaded = false;
  data = [];
  document.getElementById("fileInput").value = "";
  tableDiv.innerHTML = "";
  plotDivContainer.innerHTML = "";
  document.getElementById("addPlotDivButton").style.display = "none";

  const selectionContainers = document.querySelectorAll(".selection-container");
  selectionContainers.forEach(container => {
    container.style.display = "none";
  });

}

function parseNumberFromID(ID) {
  // meaningless if id is not a string
  if (typeof ID !== "string") return 0;
  const matches = ID.match(/\d+$/);
  return matches ? matches[0] : '';
}

// Function to update plot based on user selections
function updatePlot(ID) {
  const ID_number = parseNumberFromID(ID);
  // proccess only if you get an id
  if (ID_number === 0) return;

  // Get user selections
  let xColumn = parseInt(document.getElementById("xSelect" + ID_number).value);
  let yColumn = parseInt(document.getElementById("ySelect" + ID_number).value);
  let errorColumn = parseInt(document.getElementById("errorSelect" + ID_number).value);

  // If error bar is NOT chosen arbitrarily, make sure that the error bar is 
  // always after the y-column.
  if (!errorBarChange) {
    errorColumn = yColumn + 2 != numColumns + 1 ? yColumn + 2 : 0;
    document.getElementById("errorSelect" + ID_number).selectedIndex = errorColumn;
  }

  const lineTypeSelect = document.getElementById("lineTypeSelect" + ID_number);
  const lineType = lineTypeSelect.value;
  const plotData = loadDataByColumn(xColumn, yColumn, errorColumn, lineType, "xSelect" + (ID_number));

  // If title is changed manually, update the title with that.
  //const titlePlotly = document.getElementsByClassName('gtitle')[ID_number - 1].innerHTML;

  // Define the layout, labels, and titles
  const layout = {
    title: 'Enter Title',
    titlefont: { size: 18 },
    showlegend: true,
    xaxis: {
      title: header[xColumn],
      showline: true,
      mirror: true,
      titlefont: { size: 15 },
    },
    yaxis: {
      title: header[yColumn],
      showline: true,
      mirror: true,
      titlefont: { size: 15 },
    },
    aspectratio: { x: 1, y: 1 },
  };

  if (!plotInstance) {
    plotInstance = Plotly.newPlot(`plotDiv${ID_number}`, plotData, layout, { responsive: true, editable: true });
  } else {
    // Plotly.react(`plotDiv${ID_number}`, plotData, layout); The resize doesn't work using this method.
    Plotly.newPlot(`plotDiv${ID_number}`, plotData, layout, { responsive: true, editable: true });
  }

  updateTableHighlight(ID_number);
  // Save the plot settings
  const savePlot = {
    data: plotData,
    layout: layout,
  };
  savePlots[`plotDiv${ID_number}`] = savePlot;
}


// Load and return the plotData in terms of which selected columns, linetype and div-ID
// This function creates the traces/graphs needed for Plotly.
// If multiple y-axis are added, then plotData will return an array, where Plotly will plot each element.
function loadDataByColumn(n_xCol = 0, n_yCol = 1, n_errorCol = 2, lineType, ID) {
  ID_number = parseNumberFromID(ID);
  let lineShape = document.getElementById("lineShapeSelect" + ID_number).value;
  let showErrors = document.getElementById("errorSelect" + ID_number).value == -1 ? false : true;
  let xData = data[n_xCol].map(value => parseFloat(value));
  let yData = data[n_yCol].map(value => parseFloat(value));

  if (n_errorCol == numColumns) n_errorCol--;

  let errorData = showErrors ? data[n_errorCol].map(value => parseFloat(value)) : null;

  let traceConfig = new TraceConfig(xData, yData, n_yCol, lineType, lineShape, 'scatter', showErrors, errorData);
  let plotData = [traceConfig.getTrace()];

  // Look for the amount of added y-axes. If > 0, then add their traces to the plotData.
  let n_yAxis = document.getElementById('newYaxis_' + ID_number).children.length;
  if (n_yAxis == 0) return plotData;
  else {
    var newDiv = document.querySelectorAll(`.newDiv${ID_number}`);
    Array.prototype.forEach.call(newDiv, function (element) {
      let newYAxis = element.children[1];
      let newLineType = element.children[2];
      let newLineShape = element.children[3];

      let newYColumnIndex = newYAxis.value;
      yData = data[newYColumnIndex].map(value => parseFloat(value));
      let newTrace = { x: xData, y: yData, marker: { color: newYAxis.style.backgroundColor }, 
      name: header[newYColumnIndex], mode: newLineType.value, line: { shape: newLineShape.value}};
      plotData.push(newTrace);
    });
    return plotData
  }
}

// Function to fill the selection menus with column options
function fillSelectionMenus(ID) {
  ID_number = parseNumberFromID(ID);

  const xSelect = document.getElementById("xSelect" + ID_number);
  const ySelect = document.getElementById("ySelect" + ID_number);
  const errorSelect = document.getElementById("errorSelect" + ID_number);

  // Create a placeholder option for the error bar
  errorSelect.innerHTML = '<option value="-1">None</option>';


  // Create options for xSelect and ySelect
  let optionsHtml = "";
  for (let i = 0; i < header.length; i++) {
    optionsHtml += `<option value="${i}">${header[i]}</option>`;
  }
  xSelect.innerHTML = optionsHtml;
  ySelect.innerHTML = optionsHtml;
  errorSelect.innerHTML += optionsHtml; // Append to the existing 'None' option
}


// Function to update the table highlighting based on user selections
function updateTableHighlight(ID) {
  ID_number = parseNumberFromID(ID);
  const xColumnIndex = parseInt(document.getElementById("xSelect" + ID_number).value);
  const yColumnIndex = parseInt(document.getElementById("ySelect" + ID_number).value);
  let errorColumnIndex = parseInt(document.getElementById("errorSelect" + ID_number).value) == -1 ? 0 : parseInt(document.getElementById("errorSelect" + ID_number).value) + 1;
  // Save current selection for next time
  localStorage.setItem("xSelect" + ID_number, xColumnIndex);
  localStorage.setItem("ySelect" + ID_number, yColumnIndex);
  localStorage.setItem("errorSelect" + ID_number, errorColumnIndex);

  const table = document.querySelector("#tableDiv table");
  const rows = table.querySelectorAll("tr");
  errorColumnIndex--;
  // Remove any existing highlighting
  rows.forEach(row => {
    const cells = row.querySelectorAll("td");
    cells.forEach(cell => {
      cell.classList.remove("selected-x", "selected-y", "selected-error");
    });
  });

  // Apply highlighting to the selected X and Y columns
  rows.forEach(row => {
    const cells = row.querySelectorAll("td");
    cells[xColumnIndex].classList.add("selected-x");
    cells[yColumnIndex].classList.add("selected-y");
    // Don't color the error column if "None" was selected.
    if (errorColumnIndex != -1) cells[errorColumnIndex].classList.add("selected-error");
  });
}

// Function to open a floating window with the current plot
function openFloatingWindow(savePlot_div) {
  const plotData = JSON.stringify(savePlots[savePlot_div].data);
  const layout = JSON.stringify(savePlots[savePlot_div].layout);

  localStorage.setItem('plotData', plotData);
  localStorage.setItem('layout', layout);

  const windowWidth = Math.min(window.innerWidth, 800);
  const windowHeight = Math.min(window.innerHeight, 600);
  const windowLeft = (window.screen.width - windowWidth) / 2;
  const windowTop = (window.screen.height - windowHeight) / 2;

  const newWindowURL = `floating_plot.html?plotData`;
  const newWindow = window.open(newWindowURL, '_blank', `width=${windowWidth},height=${windowHeight},left=${windowLeft},top=${windowTop},location=no`);
}

// Function to handle resizing of the plotDiv
function handleResize(plotDivId) {
  // Clear the previous resizeTimeout to prevent multiple function calls
  clearTimeout(resizeTimeout);
  // Set a new resizeTimeout to trigger updatePlot() after a delay
  resizeTimeout = setTimeout(() => {
    updatePlot(plotDivId);
  }, 1); // Adjust the delay time as needed (5 milliseconds in this example)
}

function addPlotDiv() {
  // Create a new div for the plot and controls
  const newDiv = document.createElement('div');
  newDiv.classList.add('resizable');
  newDiv.innerHTML = `
    <div id="controlsTable${plotDivCount}" style="height: 100%; overflow:scroll; height:400px; width: 120px">
          <div class="selection-container">
            <label class="select-label" for="xSelect${plotDivCount}">X-axis:</label>
            <select class="selection-bar" style="background-color: #ffd54f;" id="xSelect${plotDivCount}"
              onchange="updatePlot('xSelect${plotDivCount}');  updateTableHighlight('xSelect${plotDivCount}');"></select>
          </div>
          <div class="selection-container">
            <label class="select-label" for="ySelect${plotDivCount}">Y-axis:</label>
            <select class="selection-bar" style="background-color: #64b5f6;" id="ySelect${plotDivCount}"
              onchange="errorBarChange = false; updatePlot('ySelect${plotDivCount}'); updateTableHighlight('ySelect${plotDivCount}');"></select>
          </div>
          <div class="selection-container">
            <label class="select-label" for="errorSelect${plotDivCount}">Error Bars:</label>
            <select class="selection-bar" style="background-color: #37ad6d;" id="errorSelect${plotDivCount}"
              onchange="errorBarChange = true; updatePlot('errorSelect${plotDivCount}'); updateTableHighlight('errorSelect${plotDivCount}');">
            </select>
          </div>
          <div class="selection-container">
          <label class="select-label" for="lineTypeSelect${plotDivCount}">Line Type:</label>
          <select class="selection-bar" id="lineTypeSelect${plotDivCount}" onchange="updatePlot('errorSelect${plotDivCount}');">
            <option value="markers">Scatter</option>
            <option value="lines">Line</option>
            <option value="lines+markers">Lines + Marker</option>
          </select>
        </div>
        <div class="selection-container">
          <label class="select-label" for="lineShapeSelect${plotDivCount}">Line Shape:</label>
          <select class="selection-bar" id="lineShapeSelect${plotDivCount}" onchange="updatePlot('errorSelect${plotDivCount}');">
            <option value="spline">Spline</option>
            <option value="linear">Linear</option>
          </select>
        </div>
        <div>
          <div class="selection-container" id="newYaxis_${plotDivCount}"></div>
          <button class="add-button" onclick="addNewYAxis('${plotDivCount}')">&#43;</button>
        </div>
       </div>
    <div id="plotDiv${plotDivCount}" class="plotDivs"></div>

    <div class="float-button" title="Open in new window" onclick="openFloatingWindow('plotDiv${plotDivCount}')">&#x2B;</div>
    <div class="close-button" title="Close plot" onclick="removePlotDiv(this)">&times;</div>
  `;

  // Add the new div to the plotDivContainer
  plotDivContainer.appendChild(newDiv);

  // Update the layout to display divs in pairs
  arrangePlotDivs();
  let st = "xSelect" + plotDivCount;
  fillSelectionMenus(st);
  let xColumn = (localStorage.getItem("xSelect" + (plotDivCount)) != null) ? localStorage.getItem("xSelect" + ID_number) : 0;
  let yColumn = (localStorage.getItem("ySelect" + (plotDivCount)) != null) ? localStorage.getItem("ySelect" + ID_number) : 1;
  let errorColumn = (localStorage.getItem("errorSelect" + (plotDivCount)) != null) ? localStorage.getItem("errorSelect" + ID_number) : 2;

  document.getElementById("xSelect" + (plotDivCount)).selectedIndex = xColumn;
  document.getElementById("ySelect" + (plotDivCount)).selectedIndex = yColumn;
  document.getElementById("errorSelect" + (plotDivCount)).selectedIndex = errorColumn;

  // Create a new plot instance and store the reference
  const plotDivId = `plotDiv${plotDivCount}`;
  const plotData = loadDataByColumn(xColumn, yColumn, errorColumn, 'markers', "xSelect" + (plotDivCount)); // Set initial values as required

  // store number of plots for next session
  localStorage.setItem("nPlots", plotDivCount);
  // Increment the plotDivCount for the next div
  plotDivCount++;

  let layout = {
    title: 'Enter title',
    titlefont: { size: 18 },
    xaxis: {
      title: header[xColumn],
      showline: true,
      mirror: true,
      titlefont: { size: 15 },
    },
    yaxis: {
      title: header[yColumn],
      showline: true,
      mirror: true,
      titlefont: { size: 15 },
    },
    aspectratio: { x: 1, y: 1 },
    //width: document.getElementById(plotDivId).style.width / 2,
  };
  const plotInstance = Plotly.newPlot(plotDivId, plotData, layout, { responsive: true, editable: true });
  plotInstances[plotDivId] = plotInstance;
  savePlots[plotDivId] = savePlot;

  // Attach the ResizeObserver to the plot div
  const plotDivElement = document.getElementById(plotDivId);
  const resizeObserver = new ResizeObserver(() => {
    handleResize(plotDivId); // Pass the ID of the resized div to handleResize function
  });
  resizeObserver.observe(plotDivElement);

  // Add the plot div element to the plotDivs array
  //plotDivIDs.push(plotDivElement);
}

function removePlotDiv(div) {
  const plotDivId = div.parentNode.querySelector('div[id^="plotDiv"]').id;
  plotDivContainer.removeChild(div.parentNode);
  let ID_number = parseNumberFromID(div);
  console.log(ID_number);
  // decrement plotDivCount and stored number of plots
  plotDivCount--;
  localStorage.setItem("nPlots", plotDivCount - 1);
  // Update the layout to display divs in pairs
  //arrangePlotDivs();

  // Remove the plot instance from the stored references
  delete plotInstances[plotDivId];
  delete savePlots[plotDivId];

  localStorage.removeItem('xSelect' + ID_number);
  localStorage.removeItem('ySelect' + ID_number);
  localStorage.removeItem('errorSelect' + ID_number);
}

function arrangePlotDivs() {
  const plotDivs = plotDivContainer.getElementsByClassName('resizable');
  // Clear existing float classes and add float classes
  for (let i = 0; i < plotDivs.length; i++) {
    plotDivs[i].classList.remove('float-left');
    plotDivs[i].classList.add('float-left');
  }
}

function popPlot(e) {
  let plotHTML = e.parentNode.innerHTML;
  return;
  var newWin = open('url', 'windowName');
  newWin.document.write(plotHTML);
}

function getRandomColor() {
  const hue = Math.floor(Math.random() * 360); // Random hue value (0-359)
  const saturation = Math.floor(Math.random() * 30) + 70; // Random saturation value (70-100)
  const lightness = Math.floor(Math.random() * 30) + 50; // Random lightness value (50-80)
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/* 
  This function creates a set of new selection bars to plot a new set of data on the same graph.
  - plotDivCount is the ID-number of the selected plotDiv
*/
function addNewYAxis(plotDivCount) {
  // Access the new y-data on the plotDiv.
  const newYaxisContainer = document.getElementById(`newYaxis_${plotDivCount}`);
  
  // Add a div for all the plot information
  const newDiv = document.createElement('div');
  newDiv.className = `newDiv${plotDivCount}`;
  newDiv.style = `border: 1px solid black;`

  // Add the remove button
  const newButton = document.createElement('button');
  newButton.className = `close-button-yAxis`;
  newButton.innerHTML = `&times;`;
  newButton.setAttribute('onclick', `removeYAxis(this, ${plotDivCount})`);
  newDiv.appendChild(newButton);

  // Create a selection bar for the new Y-axis data
  const newYSelect = document.createElement('select');
  newYSelect.className = 'selection-bar';
  newYSelect.style.backgroundColor = getRandomColor(); // Set a random background color

  // Populate the new Y-axis selection bar with options
  for (let i = 0; i < header.length; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = header[i];
    newYSelect.appendChild(option);
  }
  // Add the updatePlot on the onchange.
  newYSelect.setAttribute('onchange', `updatePlot('newYaxis${plotDivCount}')`);

  // Append the new selection bar to the container
  newYaxisContainer.appendChild(newDiv);
  newDiv.appendChild(newYSelect);

  // Add the line type selection bar
  newDiv.innerHTML += `<select class="selection-bar" onchange="updatePlot('lineType${plotDivCount}');">
  <option value="markers">Scatter</option>
  <option value="lines">Line</option>
  <option value="lines+markers">Lines + Marker</option>
  </select>`;
  // Add the line shape selection bar
  newDiv.innerHTML += `<select class="selection-bar" onchange="updatePlot('lineShape${plotDivCount}');">
  <option value="spline">Spline</option>
  <option value="linear">Linear</option>
  </select>`;

  // Update the plot
  updatePlot(plotDivCount);
}

function removeYAxis(yAxisDiv, plotDivCount){
  yAxisDiv.parentNode.remove(yAxisDiv.parentNode);
  updatePlot(`${plotDivCount}`);
}