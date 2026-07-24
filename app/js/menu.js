import cytoscape from 'cytoscape';
import { cy } from './cy-utilities.js';
import convert from 'sbgnml-to-cytoscape';
import { convert as cytoscapeToSbgnml } from './cytoscape-to-sbgnml.js'
import sbgnStylesheet from 'cytoscape-sbgn-stylesheet';
import { saveAs } from 'file-saver';
import format from 'xml-formatter';
import uggly from 'uggly';

/* General */

$('.ui.accordion').accordion({
	exclusive: true 
});

$("#convertImageToSbgnVideo").on("click", function (event) {
	event.preventDefault();
	event.stopPropagation();

	$("#imageToSbgnVideoModal").modal("show");
	$('.ui.embed').embed();
});

$('.ui.checkbox').checkbox();

/* Image-to-SBGN Menu */

let base64data;
let userInputText;
let sbgnmlText;
let sbgnmlfilename = "new_file.sbgn";

document.getElementById("samples").addEventListener("change", function (event) {
	let sample = event.target.value;
	let filename = "";
	if (sample == "sample1") {
		filename = "AF_sample1.png";
	}
	else if (sample == "sample2") {
		filename = "AF_sample2.png";
	}
	else if (sample == "sample3") {
		filename = "AF_sample3.png";
	}
	else if (sample == "sample4") {
		filename = "PD_sample1.png";
	}
	else if (sample == "sample5") {
		filename = "PD_sample2.png";
	}
	else if (sample == "sample6") {
		filename = "PD_sample3.png";
	}
	loadSample('app/samples/' + filename);

	const selectedSample = this.value;

	// Get the radio buttons
	const radioPD = document.getElementById('radioPD');
	const radioAF = document.getElementById('radioAF');

	// Uncheck both radios
	radioPD.checked = false;
	radioAF.checked = false;

	// Check the appropriate radio based on the selected sample
	if (selectedSample === 'sample1' || selectedSample === 'sample2' || selectedSample === 'sample3') {
		radioAF.checked = true; // AF for sample1, sample2 and sample3
	} else if (selectedSample === 'sample4' || selectedSample === 'sample5' || selectedSample === 'sample6') {
		radioPD.checked = true; // PD for sample4, sample5 and sample6
	}
});

$("#load-image").on("click", function (e) {
	$("#image-input").trigger('click');
});

/* $("#upload-file").on("click", function (e) {
	$("#file-input-cy").trigger('click');
}); */

document.getElementById("image-input").addEventListener("change", async function (file) {
	let input = file.target;
	let reader = new FileReader();
	reader.onload = function () {
		base64data = reader.result;
		let output = document.getElementById('inputImage');
		output.src = base64data;
		output.style.removeProperty('width')
		output.style.maxHeight = "100%";
		sbgnmlText = undefined;
	};
	reader.readAsDataURL(input.files[0]);
});

/* document.getElementById("file-input-cy").addEventListener("change", async function (event) {
	const files = Array.from(event.target.files);

	files.forEach(async (file) => {
    if (file.name.endsWith('.json')) {
      const text = await file.text();
      try {
        const json = JSON.parse(text);
        cy.elements().remove();
        cy.json({elements: json.elements});
				cy.layout({name: "preset"}).run();
				let finalSbgnml = cytoscapeToSbgnml(cy, "activity flow");
				finalSbgnml = format(finalSbgnml);
				let blob = new Blob([finalSbgnml], { type: "text/xml" });
				saveAs(blob, file.name.replace(/\.[^/.]+$/, "") + ".sbgnml");

      } catch (err) {
        console.error(`Failed to parse ${file.name}:`, err);
      }
    }
	});

	let input = file.target;
	let reader = new FileReader();
	reader.onload = function () {
		let cyJson = JSON.parse(reader.result);
		cy.json({elements: cyJson.elements});
	};
	reader.readAsText(input.files[0]);
}); */

document.getElementById("inputImage").addEventListener("click", function () {
	let imageContent = document.getElementById("imageContent");
	imageContent.src = base64data;
	$('#imageModal').modal({ inverted: true }).modal('show');
});

document.getElementById("processData").addEventListener("click", async function (e) {
	if (base64data !== undefined) {
		// reset other data
		sbgnmlText = undefined;
		let keepContent = getMapStatus();
		if(!keepContent) {
			cy.remove(cy.elements());
		}
		cy.nodes().unselect();
		e.currentTarget.style.backgroundColor = "#f2711c";
		e.currentTarget.className += " loading";
		document.getElementById("processWarning").style.display = "block";
		document.getElementById('tokenCount').textContent = `Tokens used:`;
		await communicate(base64data, userInputText);
	}
	else {
		document.getElementById("file-type").textContent = "You must first load a valid file!";
	}
});

function getMapType() {
	// Get all radio buttons with the name 'language'
	const radios = document.getElementsByName('language');

	// Loop through the radio buttons and return the one that's checked
	for (let i = 0; i < radios.length; i++) {
		if (radios[i].checked) {
			return radios[i].nextElementSibling.innerText; // Get the label text (PD or AF)
		}
	}
	return null; // If none are checked
}

function getModelType() {
	// Get all radio buttons with the name 'model'
	const radios = document.getElementsByName('model');

	// Loop through the radio buttons and return the one that's checked
	for (let i = 0; i < radios.length; i++) {
		if (radios[i].checked) {
			return radios[i].id; // Get the model id (openai or gemini)
		}
	}
	return null; // If none are checked
}

function getMapStatus() {
	// Check if keep content is active
	const keepContent = document.getElementById('mapStatus').checked;
	return keepContent;
}

function loadSample(fname) {
	cy.nodes().unselect();
	fetch(fname).then(function (res) {
		return res.blob();
	}).then(blob => new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = function () {
			base64data = reader.result;
			let output = document.getElementById('inputImage');
			output.src = base64data;
			output.style.removeProperty('width')
			output.style.maxHeight = "100%";
			sbgnmlText = undefined;
		};
		reader.readAsDataURL(blob)
	}))
};

// evaluate positions
let communicate = async function (pngBase64, userInputText) {

	let language = getMapType();
	let model = getModelType();
	let data = {
		context: userInputText,
		image: pngBase64,
		language: language,
		model: model
	};

	let response = await sendRequestToGPT(data);
	try {
		sbgnmlText = response.answer;
		sbgnmlText = sbgnmlText.replaceAll('\"', '"');
		sbgnmlText = sbgnmlText.replaceAll('\n', '');
		sbgnmlText = sbgnmlText.replaceAll('empty set', 'source and sink');
		document.getElementById('tokenCount').textContent = `Tokens used: ${response.totalTokens}`;
		await generateCyGraph(sbgnmlText);
	} catch (error) {
		console.log(error);
		alert("Output SBGNML from LLM is not in the correct format! Please try again!");
		console.log("Output SBGNML is not in the correct format");
		document.getElementById("processWarning").style.display = "none";
		document.getElementById("processData").style.backgroundColor = "#d67664";
		document.getElementById("processData").classList.remove("loading");
	}
};

let sendRequestToGPT = async function (data) {
	const settings = {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'text/plain'
		},
		body: JSON.stringify(data)
	};

	let res = await fetch('https://dev.sciluna.com/image2sbgn/sbgnml/from-image', settings)
		.then(response => response.json())
		.then(result => {
			return result;
		})
		.catch(e => {
			console.log("Error!");
		});
	return res;
};

function generateNodeId(prefix = 'node') {
  return `${prefix}-${Math.random().toString(36).substring(2, 11)}`;
}

async function setIdentifiers (nodeLabelArray){
	let identifiers = await mapIdentifiers(nodeLabelArray);

	let identifiersMap = new Map();
	identifiers.forEach(item => {
		item.forEach(data => {
			if (data.score >= 0.6) {
				let query = data.match.query;
				let content = { db: data.term.db, id: data.term.id, url: data.url };
				if (identifiersMap.has(query)) {
					identifiersMap.get(query).push(content);
				} else {
					identifiersMap.set(query, [content]);
				}
			}
		});
	});
	//console.log(identifiersMap);
	identifiersMap.forEach((value, key, map) => {
		let cyNodes = cy.nodes().filter(node => {
			return node.data('label') == key;
		});
		cyNodes.forEach(cyNode => {
			cyNode.data("identifierData", value);
			cyNode.data("annotations", [{
				annotationValue: value[0].url,
				selectedDB: value[0].db,
				status: "validated",
				selectedRelation: "bqbiol:is"
			}]);
		});
	});
}

let generateCyGraph = async function (graphContent, source = "sbgn", layoutType = "fcose") {
	let cyGraph;
	if (source == "sbgn") {
		cyGraph = convert(graphContent);
	} else if(source == "json") {
		cy.style(defaultStylesheet);
		cyGraph = graphContent.elements;
	}
	
	// change node/edge ids to allow keeping current content (otherwise nodes/edges with same ids cannot be added)
	let nodeNewIdMap = new Map();
	cyGraph.nodes.forEach(node => {
		const randomId = generateNodeId();
		nodeNewIdMap.set(node.data.id, randomId);
		node.data.id = randomId;
	});
	cyGraph.nodes.forEach(node => {
		node.data.parent = nodeNewIdMap.get(node.data.parent);
	});
	cyGraph.edges.forEach(edge => {
		const randomId = generateNodeId('edge');
		edge.data.source = nodeNewIdMap.get(edge.data.source);
		edge.data.target = nodeNewIdMap.get(edge.data.target);
		edge.data.id = randomId;
	});

	let addedGraph = cy.add(cyGraph);
	if (source == "sbgn") {
		addedGraph.nodes().not(":parent").forEach(
			(node) => {
				node.position({ x: node.data('bbox').x, y: node.data('bbox').y });
			}
		);
	}
	//cy.nodes().grabify(); // for graphs from reactome cy.json
	// adjust context menu items
	if (cy.nodes("[class = 'process']").length > 0) {
		document.getElementById("radioPD").checked = true;
	}
	let language = getMapType();
	let contextMenu = cy.contextMenus('get');
	let pdItemIDs = ["consumption", "production", "modulation", "stimulation", "catalysis", "inhibition", "macromolecule", "simpleChemical", "unspecifiedEntity", "nucleicAcidFeature", "perturbingAgent", "emptySet", "complex", "process"];
	let afItemIDs = ["positiveInfluence", "negativeInfluence", "unknownInfluence", "biologicalActivity", "delay"];
	if (language == "PD") {
		pdItemIDs.forEach(itemID => {
			contextMenu.showMenuItem(itemID);
		});
		afItemIDs.forEach(itemID => {
			contextMenu.hideMenuItem(itemID);
		});
	} else if (language == "AF") {
		pdItemIDs.forEach(itemID => {
			contextMenu.hideMenuItem(itemID);
		});
		afItemIDs.forEach(itemID => {
			contextMenu.showMenuItem(itemID);
		});
	}
	// apply layout
	if (layoutType == "preset") {
		cy.layout({ name: layoutType }).run();
	} else if (layoutType == "fcose" && document.getElementById("polishConversion").checked) {
		cy.layout({ name: layoutType, randomize: false, mapType: language, initialEnergyOnIncremental: 0.3, padding: 60}).run();
	} else {
		cy.layout({ name: "preset", fit: true }).run();
	}

	// apply identifier mapping
	let nodesToQuery = cy.nodes().filter(node => {
		return node.data("label");
	});
	nodesToQuery = nodesToQuery.map(node => {
		return node.data("label");
	});
	nodesToQuery = nodesToQuery.filter((value, index, array) => {
		return array.indexOf(value) === index;
	});
	await setIdentifiers(nodesToQuery);

	document.getElementById("processWarning").style.display = "none";
	document.getElementById("processData").style.backgroundColor = "#d67664";
	document.getElementById("processData").classList.remove("loading");
	document.getElementById("submitEdit").classList.remove("loading");
};

let mapIdentifiers = async function (nodeLabelArray) {
	let data = [];
	nodeLabelArray.forEach(item => {
		data.push({ text: item });
	});
	data = JSON.stringify(data);

	let url = "https://dev.sciluna.com/image2sbgn/anno";
	const settings = {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'text/plain'
		},
		body: data
	};

	let identifiers = await fetch(url, settings)
		.then(response => response.json())
		.then(result => {
			return result;
		})
		.catch(e => {
			console.log("Error!");
		});

	return identifiers;
};

let generateObjectContent = function (node, identifierData) {
	// Create the main div element
	const div = document.createElement('div');
	div.setAttribute("id", "objectData");
	div.setAttribute("class", "inline field");

	// Create a title for the id
	const title = document.createElement('h4');
	title.textContent = node.data('label');

	// Create an edit icon 
	const editIcon = document.createElement('span');
	editIcon.textContent = '✏️'; // You can replace this with an icon image if needed
	editIcon.style.cursor = 'pointer';
	editIcon.style.marginLeft = '10px';

	// Add an event listener to switch to input field when clicked
	editIcon.addEventListener('click', () => {
		// Replace h3 with an input field
		const labelInput = document.createElement('input');
		labelInput.setAttribute("type", "text");
		labelInput.setAttribute("id", "labelInput");
		labelInput.value = title.textContent; // Set the current label text as input value

		labelInput.addEventListener('keydown', async (event) => {
			if (event.key === 'Enter') {
				title.textContent = labelInput.value;
				div.replaceChild(title, labelInput);
				node.data('label', title.textContent);
				await setIdentifiers([node.data('label')]);
				node.unselect();
				node.select();
			}
		});

		div.replaceChild(labelInput, title); // Replace h3 with input
	});

	div.appendChild(title);
	div.appendChild(editIcon);

	if (node.data("identifierData")) {
		// Loop through the dataArray and generate content for each object
		identifierData.forEach((dataItem, i) => {
			if(i == 0) { // TODO: show all identifiers
				// Create a table with Fomantic UI classes
				const table = document.createElement('table');
				table.className = 'ui celled table';

				// Create a table body
				const tbody = document.createElement('tbody');

				// Create a row for each object in dataArray
				const row = document.createElement('tr');

				const dbCell = document.createElement('td');
				dbCell.textContent = dataItem.db;

				const idCell = document.createElement('td');
				const link = document.createElement('a');
				link.href = dataItem.url;
				link.textContent = dataItem.id;
				link.target = '_blank';
				idCell.appendChild(link);

				row.appendChild(dbCell);
				row.appendChild(idCell);
				tbody.appendChild(row);

				table.appendChild(tbody);
				div.appendChild(table);
			}
		});
	}

	return div;
};

cy.on("select", "node", function (evt) {
	if(cy.nodes(":selected").length == 1) {
		let node = evt.target;
		if (node.data("label") && node.data("label") != "") {
			let objectContent = generateObjectContent(node, node.data("identifierData"));
			let objectView = document.getElementById("objectView");
			objectView.appendChild(objectContent);
		}
	} else {
		let objectView = document.getElementById("objectView");
		if (objectView.querySelector("#objectData") != null) {
			let objectData = document.getElementById("objectData");
			objectView.removeChild(objectData);
		}
	}
});

cy.on("unselect", "node", function (evt) {
	if(cy.nodes(":selected").length != 1) {
		let objectView = document.getElementById("objectView");
		if (objectView.querySelector("#objectData") != null) {
			let objectData = document.getElementById("objectData");
			objectView.removeChild(objectData);
		}
	} else {
		let node = cy.nodes(":selected")[0];
		if (node.data("label") && node.data("label") != "") {
			let objectContent = generateObjectContent(node, node.data("identifierData"));
			let objectView = document.getElementById("objectView");
			objectView.appendChild(objectContent);
		}
	}
});

cy.on("remove", "node", function (evt) {
	let objectView = document.getElementById("objectView");
	if (objectView.querySelector("#objectData") != null) {
		let objectData = document.getElementById("objectData");
		objectView.removeChild(objectData);
	}
});

/* Merge/Split Maps Menu */

document.getElementById("mergePairwise").addEventListener('change', (event) => {
    if (event.target.checked) {
      document.getElementById("strictCheck").disabled = false;
			document.getElementById("strictCheckLabel").style.opacity = 1;
			document.getElementById("addSourceComponent").disabled = true;
			document.getElementById("addTargetComponent").disabled = true;
		  document.getElementById("componentMessage").style.opacity = 0.5;
    } else {
			document.getElementById("strictCheck").disabled = true;
			document.getElementById("strictCheckLabel").style.opacity = 0.5;
			document.getElementById("addSourceComponent").disabled = false;
			document.getElementById("addTargetComponent").disabled = false;
			document.getElementById("componentMessage").style.opacity = 1;
    }
});

let sourceComponent = null;
let targetComponent = null;

document.getElementById("addSourceComponent").addEventListener("click", function () {
	let selectedComponent = cy.elements(":selected");
	let componentMessage = document.getElementById("componentMessage");
	if (selectedComponent.nodes().length == 0) {
		sourceComponent = null;
		componentMessage.textContent = "Please select a source component to add!";
	} else {
		sourceComponent = selectedComponent;
		componentMessage.textContent = "Source component added!";
		selectedComponent.unselect();
	}
});

document.getElementById("addTargetComponent").addEventListener("click", function () {
	let selectedComponent = cy.elements(":selected");
	let componentMessage = document.getElementById("componentMessage");
	if (selectedComponent.nodes().length == 0) {
		targetComponent = null;
		componentMessage.textContent = "Please select a target component to add!";
	} else {
		targetComponent = selectedComponent;
		componentMessage.textContent = "Target component added!";
		selectedComponent.unselect();
	}
});

function getAnimationType() {
	// Get all radio buttons with the name 'animation'
	const radios = document.getElementsByName('animation');

	// Loop through the radio buttons and return the one that's checked
	for (let i = 0; i < radios.length; i++) {
		if (radios[i].checked) {
			let text = radios[i].nextElementSibling.innerText; // Get the label text (End or During)
			if (text == "End") {
				return "end";
			} else {
				return "during";
			}
		}
	}
	return null; // If none are checked
}

document.getElementById("mergeButton").addEventListener("click", function () {
	let selectedComponent;
	let unselectedComponent;

	let mergeSplit = cy.mergeSplit('get');
	mergeSplit.setOption("checkLabel", document.getElementById("checkLabel").checked);
	mergeSplit.setOption("checkIdentifier", document.getElementById("checkIdentifier").checked);
	mergeSplit.setOption("checkCardinality", document.getElementById("checkCardinality").checked);
	mergeSplit.setOption("animate", getAnimationType());

	if (!document.getElementById("mergePairwise").checked) {
		selectedComponent = sourceComponent;
		unselectedComponent = targetComponent;
		if (selectedComponent != null && unselectedComponent != null) {
			mergeSplit.merge(selectedComponent, unselectedComponent);
			sourceComponent = null;
			targetComponent = null;
			let componentMessage = document.getElementById("componentMessage");
			componentMessage.textContent = "Select and add source and target components!";
		}
	} else { // pairwise merge is active
		if (cy.nodes(":selected").length == 2) {
			let node1 = cy.nodes(":selected")[0];
			let node2 = cy.nodes(":selected")[1];
			mergeSplit.mergePairwise(node1, node2, document.getElementById("strictCheck").checked);
		}
	}
});

document.getElementById("splitButton").addEventListener("click", function () {
	let selectedComponent = cy.elements(":selected");

	// apply split 
	let mergeSplit = cy.mergeSplit('get');
	let splittedComponent = mergeSplit.split(selectedComponent, document.getElementById("keepConnectionPoint").checked, "auto", 150);

/* 	// Add clone markers when necessary
	let restOfGraph = cy.elements().not(splittedComponent);
	restOfGraph.unselect();
	if(getMapType() == 'PD') {
		let classesWithCloneMarker = ['unspecified entity', 'simple chemical', 'simple chemical multimer', 'macromolecule', 'macromolecule multimer', 'nucleic acid feature', 'nucleic acid feature multimer', 'complex', 'complex multimer', 'perturbing agent']; 
		splittedComponent.nodes().forEach(node1 => {
			if(classesWithCloneMarker.includes(node1.data("class"))) {
				let label = node1.data('label');
				restOfGraph.forEach(node2 => {
					if(node2.data('label') == label) {
						node1.data('clonemarker', true);
						node2.data('clonemarker', true);
					}
				});
			}
		});
		cy.style().update();
		//cy.style(defaultStylesheet);
		//cy.style(sbgnStylesheet(cytoscape, "red_blue")).update();
	} */
});

/* document.getElementById("convertToAFButton").addEventListener("click", async function () {
	let finalSbgnml = cytoscapeToSbgnml(cy, getMapType());
	let model = getModelType();
	let data = {
		pd_sbgnml: finalSbgnml,
		model: model
	};

	const settings = {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'text/plain'
		},
		body: JSON.stringify(data)
	};

	let res = await fetch('http://localhost:4000/pd2af', settings)
		.then(response => response.json())
		.then(result => {
			return result;
		})
		.catch(e => {
			console.log("Error!");
		});

	let resultJSON;
	try {
		resultJSON = JSON.parse(res);
		sbgnmlText = resultJSON.answer;
		sbgnmlText = sbgnmlText.replaceAll('\"', '"');
		sbgnmlText = sbgnmlText.replaceAll('\n', '');
		sbgnmlText = sbgnmlText.replaceAll('empty set', 'source and sink');
		await generateCyGraph();
	} catch (error) {
		console.log(error);
		alert("Output SBGNML from LLM is not in the correct format! Please try again!");
		console.log("Output SBGNML is not in the correct format");
		document.getElementById("processData").style.backgroundColor = "#d67664";
		document.getElementById("processData").classList.remove("loading");
	}
}); */

/* Apply Layout Menu */

document.getElementById("applyLayout").addEventListener("click", async function () {
	let imageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
  let subset = undefined;
  if (cy.elements(':selected').length > 0) {
    subset = cy.elements(':selected');
  }
	let idealEdgeLength = parseInt(document.getElementById("idealEdgeLength").value);
	if(cy.elements(':selected').length > 0) {
		subset.layout({
			name: "sbgn-layout",
			randomize: true,
			idealEdgeLength: idealEdgeLength,
			fit: false,
			imageData: imageData,
			subset: subset,
			padding: 50
		}).run();
	} else {
		cy.layout({
			name: "sbgn-layout",
			randomize: true,
			idealEdgeLength: idealEdgeLength,
			fit: true,
			imageData: imageData,
			padding: 60
		}).run();
	}
});

document.getElementById("refineLayout").addEventListener("click", function () {
	let idealEdgeLength = parseInt(document.getElementById("idealEdgeLength").value);
	if (cy.elements(":selected").length > 0) {
		cy.elements(":selected").layout({ name: 'sbgn-layout', randomize: false, idealEdgeLength: idealEdgeLength, fit: false, mapType: getMapType(), initialEnergyOnIncremental: 0.5, padding: 60 }).run();
	} else {
		cy.layout({ name: 'sbgn-layout', randomize: false, mapType: getMapType(), idealEdgeLength: idealEdgeLength, initialEnergyOnIncremental: 0.5, padding: 60 }).run();
	}
});

document.getElementById("pinSelected").addEventListener("click", function () {
	let selectedNodes = cy.nodes(":selected");
	selectedNodes.addClass("pinned");
	selectedNodes.lock();
});

document.getElementById("unpinSelected").addEventListener("click", function () {
	let selectedNodes = cy.nodes(":selected");
	selectedNodes.removeClass("pinned");
	selectedNodes.unlock();
});

document.getElementById("unpinAll").addEventListener("click", function () {
  cy.nodes().removeClass("pinned");
	cy.nodes().unlock();
});

document.getElementById("selectAll").addEventListener("click", function () {
  cy.elements().select();
});

document.getElementById("verticalFlip").addEventListener("click", function () {
	let transform = cy.transform('get');
		let selectedNodes = cy.nodes(":selected");
	if (selectedNodes.length == 0) {
		selectedNodes = cy.nodes();
	}
	transform.flipVertical(selectedNodes);
});

document.getElementById("horizontalFlip").addEventListener("click", function () {
	let transform = cy.transform('get');
	let selectedNodes = cy.nodes(":selected");
	if (selectedNodes.length == 0) {
		selectedNodes = cy.nodes();
	}
	transform.flipHorizontal(selectedNodes);
});

document.getElementById("rotateClockwise").addEventListener("click", function () {
	let transform = cy.transform('get');
	let selectedNodes = cy.nodes(":selected");
	if (selectedNodes.length == 0) {
		selectedNodes = cy.nodes();
	}
	transform.rotate(selectedNodes, 90);
});

document.getElementById("rotateCounterclockwise").addEventListener("click", function () {
	let transform = cy.transform('get');
	let selectedNodes = cy.nodes(":selected");
	if (selectedNodes.length == 0) {
		selectedNodes = cy.nodes();
	}
	transform.rotate(selectedNodes, -90);
});

document.getElementById("selectAll").addEventListener("click", function () {
  cy.elements().select();
});

document.getElementById('clearCanvas').addEventListener('click', clearCanvas);

async function applyLayout(constraints, applyIncremental) {
  let randomize = true;
  let initialEnergyOnIncremental = 0.3;

  // if there are selected elements, apply incremental layout on selected elements
  if (cy.elements(':selected').length > 0) {
    randomize = false;
    initialEnergyOnIncremental = 0.1;
  }

  let idealEdgeLength = 100;

  try {
    callLayout(randomize, idealEdgeLength, initialEnergyOnIncremental, constraints, applyIncremental);
  } catch (error) {
    alert("Couldn't process constraints! Please try again!");
  }
}

function callLayout(randomize, idealEdgeLength, initialEnergyOnIncremental, constraints, applyIncremental) {
  cy.layout({
    name: "fcose",
    randomize: randomize,
    idealEdgeLength: idealEdgeLength,
    animationDuration: 1500,
		fit: false,
    fixedNodeConstraint: constraints.fixedNodeConstraint.length != 0 ? constraints.fixedNodeConstraint : undefined,
    relativePlacementConstraint: constraints.relativePlacementConstraint ? constraints.relativePlacementConstraint : undefined,
    alignmentConstraint: constraints.alignmentConstraint ? constraints.alignmentConstraint : undefined,
    initialEnergyOnIncremental: initialEnergyOnIncremental,
    stop: () => {      
      if (applyIncremental) {
        cy.layout({
          name: "sbgn-layout",
					mapType: getMapType(),
          randomize: false,
					fit: true,
          animationDuration: 500,
          idealEdgeLength: idealEdgeLength,
          fixedNodeConstraint: constraints.fixedNodeConstraint.length != 0 ? constraints.fixedNodeConstraint : undefined,
          initialEnergyOnIncremental: 0.05
        }).run();
      }
    }
  }).run();
};

/* Graph View Options */

$("#uploadGraph").on("click", function (e) {
	$("#file-input-graph").trigger('click');
});

document.getElementById("file-input-graph").addEventListener("change", async function (e) {
	let file = e.target.files[0];
	let fileExtension = file.name.split('.').pop();
	let reader = new FileReader();
	reader.onload = async function () {
		if (fileExtension == "sbgn" || fileExtension == "sbgnml") {	// input is sbgn file
			sbgnmlText = reader.result;
			await generateCyGraph(sbgnmlText, "sbgn", "preset");
			sbgnmlText = undefined;
		} else if (fileExtension == "json") {	// input is cytoscape.js json file
			let content = JSON.parse(reader.result);
			await generateCyGraph(content, "json", "preset");
		}
	};
	reader.readAsText(file);
});

/* document.getElementById("file-input-cy").addEventListener("change", async function (event) {
	const files = Array.from(event.target.files);

	files.forEach(async (file) => {
    if (file.name.endsWith('.json')) {
      const text = await file.text();
      try {
        const json = JSON.parse(text);
        cy.elements().remove();
        cy.json({elements: json.elements});
				cy.layout({name: "preset"}).run();
				let finalSbgnml = cytoscapeToSbgnml(cy, "activity flow");
				finalSbgnml = format(finalSbgnml);
				let blob = new Blob([finalSbgnml], { type: "text/xml" });
				saveAs(blob, file.name.replace(/\.[^/.]+$/, "") + ".sbgnml");

      } catch (err) {
        console.error(`Failed to parse ${file.name}:`, err);
      }
    }
	});

	let input = file.target;
	let reader = new FileReader();
	reader.onload = function () {
		let cyJson = JSON.parse(reader.result);
		cy.json({elements: cyJson.elements});
	};
	reader.readAsText(input.files[0]);
}); */

document.getElementById("downloadSbgnml").addEventListener("click", function () {
	let finalSbgnml = cytoscapeToSbgnml(cy, getMapType());
	finalSbgnml = format(finalSbgnml, {indentation: '  '});
	let blob = new Blob([finalSbgnml], { type: "text/xml" });
	saveAs(blob, sbgnmlfilename);
});

document.getElementById("openNewt").addEventListener("click", async function () {
	let finalSbgnml = cytoscapeToSbgnml(cy, getMapType());
	finalSbgnml = format(finalSbgnml, {indentation: '  '});
	const filename = await openInNewtAndDelete(finalSbgnml);
});

async function openInNewtAndDelete(sbgnContent) {
	let filename = 'diagram_' + Date.now() + '.sbgnml';
  const response = await fetch('https://dev.sciluna.com/image2sbgn/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filename: filename,
      content: sbgnContent,
    }),
  });

  const data = await response.json();
  if (data.url) {
    // Redirect to Newt Editor with the file URL
    window.open(`https://web.newteditor.org/?URL=${data.url}`, '_blank');

		setTimeout(() => {
			fetch('https://dev.sciluna.com/image2sbgn/delete', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ filename }),
			})
				.then((res) => res.json())
				.then((data) => {
					console.log('File deletion result:', data);
				})
				.catch((err) => {
					console.error('Failed to delete file:', err);
				});
		}, 5000); // 5000 ms = 5 seconds
  }
	return data.filename;
}

document.getElementById("submitEdit").addEventListener("click", async function (e) {
	let instructions = document.getElementById("editInstructions").value;
	if(instructions == "" || cy.elements().length == 0) {
		return;
	}

	let currentSbgnml = cytoscapeToSbgnml(cy, getMapType());
	currentSbgnml = format(currentSbgnml, {indentation: '  '});
	let language = getMapType();
	let model = getModelType();

	let data = {
		sbgnml: currentSbgnml,
		language: language,
		model: model,
		instructions: instructions
	};

	document.getElementById("processWarning").style.display = "block";
	document.getElementById("submitEdit").className += " loading";
	e.currentTarget.className += " loading";
	document.getElementById('tokenCount').textContent = `Tokens used:`;
	let response = await sendEditInstructions(data);

	let resultJSON;
	try {
		sbgnmlText = response.answer;
		sbgnmlText = sbgnmlText.replaceAll('\"', '"');
		sbgnmlText = sbgnmlText.replaceAll('\n', '');
		sbgnmlText = sbgnmlText.replaceAll('empty set', 'source and sink');
		document.getElementById('tokenCount').textContent = `Tokens used: ${response.totalTokens}`;
		cy.elements().remove();
		await generateCyGraph(sbgnmlText);
	} catch (error) {
		console.log(error);
		alert("Output SBGNML from LLM is not in the correct format! Please try again!");
		console.log("Output SBGNML is not in the correct format");
		document.getElementById("submitEdit").classList.remove("loading");
	}
});

async function sendEditInstructions(data) {
	const settings = {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'text/plain'
		},
		body: JSON.stringify(data)
	};

	let res = await fetch('https://dev.sciluna.com/image2sbgn/sbgnml/edit', settings)
		.then(response => response.json())
		.then(result => {
			return result;
		})
		.catch(e => {
			console.log("Error!");
		});
	return res;
}


let defaultStylesheet = [
  {
    selector: 'node',
    style: {
      'label': 'data(displayName)',
    }
  }
];

export { sendRequestToGPT, getMapType };
