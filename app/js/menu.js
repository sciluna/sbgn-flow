import { cy } from './cy-utilities.js';
import convert from 'sbgnml-to-cytoscape';
import { convert as cytoscapeToSbgnml } from './cytoscape-to-sbgnml.js'
import { saveAs } from 'file-saver';
import format from 'xml-formatter';
import uggly from 'uggly';

/* General */

$('.ui.accordion').accordion({
	exclusive: true 
});

$('.ui.checkbox').checkbox();

/* Image-to-SBGN Menu */

let base64data;
let userInputText;
let sbgnmlText;
let sbgnmlfilename = "new_file.sbgnml";

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
		filename = "PD_sample1.png";
	}
	else if (sample == "sample4") {
		filename = "PD_sample2.png";
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
	if (selectedSample === 'sample1' || selectedSample === 'sample2') {
		radioAF.checked = true; // PD for sample1
	} else if (selectedSample === 'sample3' || selectedSample === 'sample4') {
		radioPD.checked = true; // AF for sample2
	}
});

$("#load-file").on("click", function (e) {
	$("#file-input").trigger('click');
});

$("#upload-file").on("click", function (e) {
	$("#file-input-cy").trigger('click');
});

document.getElementById("file-input").addEventListener("change", async function (file) {
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
		//userInputText = document.getElementById("userInputText").value;
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
		comment: userInputText,
		image: pngBase64,
		language: language,
		model: model
	};

	let response = await sendRequestToGPT(data);
	let resultJSON;
	try {
		resultJSON = JSON.parse(response);
		sbgnmlText = resultJSON.answer;
		sbgnmlText = sbgnmlText.replaceAll('\"', '"');
		sbgnmlText = sbgnmlText.replaceAll('\n', '');
		sbgnmlText = sbgnmlText.replaceAll('empty set', 'source and sink');
		await generateCyGraph();
	} catch (error) {
		console.log(error);
		alert("Output SBGNML from GPT is not in the correct format! Please try again!");
		console.log("Output SBGNML is not in the correct format");
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

	let res = await fetch('http://3.95.207.114/gpt', settings)
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
	console.log(identifiersMap);
	identifiersMap.forEach((value, key, map) => {
		let cyNodes = cy.nodes().filter(node => {
			return node.data('label') == key;
		});
		cyNodes.forEach(cyNode => {
			cyNode.data("identifierData", value);
		});
	});
}

let generateCyGraph = async function (layoutType = "fcose") {
	let cyGraph = convert(sbgnmlText);
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
	cy.nodes().forEach(
		(node) => {
			node.position({ x: node.data('bbox').x, y: node.data('bbox').y });
		}
	);
	// adjust context menu items
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
		cy.layout({ name: layoutType, randomize: false, mapType: language, initialEnergyOnIncremental: 0.3}).run();
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

	document.getElementById("processData").style.backgroundColor = "#d67664";
	document.getElementById("processData").classList.remove("loading");
};

let mapIdentifiers = async function (nodesToQuery) {
	let data = [];
	nodesToQuery.forEach(item => {
		data.push({ text: item });
	});
	data = JSON.stringify(data);

	const settings = {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'text/plain'
		},
		body: data
	};

	let identifiers = await fetch('http://3.95.207.114/anno', settings)
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

/* Merge/Split Maps Menu */

document.getElementById("mergeButton").addEventListener("click", function () {
	let selectedComponent;
	let unselectedComponent;
	let selectedUnselectedMap = new Map()
	let idToMoveAllSelected = false;

	if (!document.getElementById("mergePairwise").checked) {
		selectedComponent = cy.elements(":selected");
		unselectedComponent = cy.elements(":unselected");

		// find intersecting nodes based on label
		selectedComponent.nodes().forEach(node1 => {
			if (node1.data("label") && !node1.isParent()){
				unselectedComponent.nodes("[label]").forEach(node2 => {
					if (node1.data("label") == node2.data("label")) {
						if (node1.parent().length == 0 && node2.parent().length == 0) { // no parent on both
							selectedUnselectedMap.set(node1.id(), node2.id());
						}
						else if (node1.parent().length > 0 && node2.parent().length > 0) { // both has parent
							if (node1.parent().data("label") == node2.parent().data("label")) {
								selectedUnselectedMap.set(node1.id(), node2.id());
								idToMoveAllSelected = node2.parent().id();
							}
						}
					}
				});
			}
		});
	} else { // pairwise merge is active
		if (cy.nodes(":selected").length == 2) {
			let node1 = cy.nodes(":selected")[0];
			let node2 = cy.nodes(":selected")[1];
			selectedComponent = node1.component();
			unselectedComponent = node2.component();
			if(!node1.isParent() && !node2.isParent() && node1.data("label") == node2.data("label") && selectedComponent.intersection(unselectedComponent).length == 0){
				if (node1.parent().length == 0 && node2.parent().length == 0) { // no parent on both
					selectedUnselectedMap.set(node1.id(), node2.id());
				}	
				else if (node1.parent().length > 0 && node2.parent().length > 0) { // both has parent
					if (node1.parent().data("label") == node2.parent().data("label")) {
						selectedUnselectedMap.set(node1.id(), node2.id());
						idToMoveAllSelected = node2.parent().id();
					}
				}
			}
		}
	}

	// calculate overall shift amount
	let shiftAmountX = 0;
	let shiftAmountY = 0;
	selectedUnselectedMap.forEach((value, key) => {
		let selectedNode = cy.getElementById(key);
		let unselectedNode = cy.getElementById(value);
		shiftAmountX += unselectedNode.position().x - selectedNode.position().x;
		shiftAmountY += unselectedNode.position().y - selectedNode.position().y;
	});
	let shiftAmount = {x: shiftAmountX / selectedUnselectedMap.size, y: shiftAmountY / selectedUnselectedMap.size};

	// animate nodes to calculated position and apply merge operation after animation completed
	selectedComponent.nodes().forEach(node => {
		node.animate({
			position: ({x: node.position().x + shiftAmount.x, y:node.position().y + shiftAmount.y}),
			duration: 2000,
			complete: () => {
				// for each intersecting node, transfer incident edges to unselected component
				selectedUnselectedMap.forEach((value, key) => {
					let selectedNode = cy.getElementById(key);
					let unselectedNode = cy.getElementById(value);
					selectedNode.incomers().edges().forEach(edge => {
						edge.move({
							target: value
						});
					});
					selectedNode.outgoers().edges().forEach(edge => {
						edge.move({
							source: value
						});
					});
					selectedNode.remove();	// remove dangling node
					unselectedNode.select();
				});
				if (idToMoveAllSelected) {
					let selectedParentId = selectedComponent.nodes()[0].parent().id();
					selectedComponent.nodes().forEach(node => {
						node.move({
							parent: idToMoveAllSelected
						});
					});
					if (idToMoveAllSelected != selectedParentId) {
						cy.getElementById(selectedParentId).remove();
					}
				}
			}
		});
	});
});

document.getElementById("splitButton").addEventListener("click", function () {
	let selectedComponent = cy.elements(":selected");
	let unselectedComponent = cy.elements(":unselected");

	let nodesToSplit = undefined;
	let edgesToRemove = undefined;
	// keep connection points
	if (document.getElementById("keepConnectionPoint").checked) {
		// find the nodes that need to be split
		nodesToSplit = selectedComponent.nodes().filter(node => {
			let filter = false;
			node.connectedEdges().forEach(edge => {
				if(!edge.selected()) {
					filter = true;
				}
			})
			return filter;
		});

		// split nodes by generating a copy and reconnecting necessary
		nodesToSplit.forEach(node => {
			let clonedNode = cy.add({ group: 'nodes', data: { id: generateNodeId(), class: node.data('class'), label: node.data('label'),'stateVariables': [], 'unitsOfInformation': [], clonemarker: node.data('clonemarker'), identifierData: node.data('identifierData'), parent: node.data('parent') }, position: { x: node.position().x, y: node.position().y } });

			node.incomers(":unselected").edges().forEach(edge => {
				edge.move({
					target: clonedNode.id()
				});
			});
			node.outgoers(":unselected").edges().forEach(edge => {
				edge.move({
					source: clonedNode.id()
				});
			});
		});
	} else {	// ignore connection points
		edgesToRemove = selectedComponent.edgesWith(unselectedComponent);
		edgesToRemove.remove();
	}

	// animation
	if (nodesToSplit) {
		// calculate overall shift amount
		let shiftAmountX = 0;
		let shiftAmountY = 0;
		let selectedBBox = selectedComponent.boundingBox();
		let unselectedBBox;
		if (selectedComponent.parent() && selectedComponent.parent().length > 0) {
			unselectedBBox = selectedComponent.parent()[0].children(":unselected").boundingBox();
		} else {
			unselectedBBox = unselectedComponent.boundingBox();
		}
		let direction = (unselectedBBox.x1 + unselectedBBox.w / 2 > selectedBBox.x1 + selectedBBox.w / 2) ? "toLeft" : "toRight";
		if (direction == "toLeft") {
			shiftAmountX = (unselectedBBox.x1 - selectedBBox.w / 2 - 100) - (selectedBBox.x1 + selectedBBox.w / 2) ;
			shiftAmountY = (unselectedBBox.y1 + unselectedBBox.h / 2) - (selectedBBox.y1 + selectedBBox.h / 2);
		} else {
			shiftAmountX = unselectedBBox.x2 - (selectedBBox.x1 + selectedBBox.w / 2) + selectedBBox.w / 2 + 100;
			shiftAmountY = (unselectedBBox.y1 + unselectedBBox.h / 2) - (selectedBBox.y1 + selectedBBox.h / 2);		
		}
		
		// animate nodes to calculated position
		selectedComponent.nodes().forEach(node => {
			node.animate({
				position: ({x: node.position().x + shiftAmountX, y: node.position().y + shiftAmountY}),
				duration: 2000
			});
		});
	}
});

/* Apply Layout Menu */

document.getElementById("applyLayout").addEventListener("click", async function () {
	let imageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
  let subset = undefined;
  if (cy.elements(':selected').length > 0) {
    subset = cy.elements(':selected');
  }
	let result = await uggly.generateConstraints({cy: cy, imageData: imageData, subset: subset});
	let constraints = result.constraints;
  let applyIncremental = result.applyIncremental;
	console.log(constraints);
	console.log(applyIncremental);
	await applyLayout(constraints, applyIncremental);
	//cy.layout({ name: 'sbgn-layout', randomize: false, mapType: getMapType(), initialEnergyOnIncremental: 0.5 }).run();
});

document.getElementById("refineLayout").addEventListener("click", function () {
	if (cy.elements(":selected").length > 0) {
		cy.elements(":selected").layout({ name: 'sbgn-layout', randomize: false, fit: false, mapType: getMapType(), initialEnergyOnIncremental: 0.5 }).run();
	} else {
		cy.layout({ name: 'sbgn-layout', randomize: false, mapType: getMapType(), initialEnergyOnIncremental: 0.5 }).run();
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

document.getElementById('clearCanvas').addEventListener('click', clearCanvas);

async function applyLayout(constraints, applyIncremental) {
  let randomize = true;
  let initialEnergyOnIncremental = 0.3;

  // if there are selected elements, apply incremental layout on selected elements
  if (cy.elements(':selected').length > 0) {
    randomize = false;
    initialEnergyOnIncremental = 0.1;
  }

  let idealEdgeLength = 60;

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
    fixedNodeConstraint: constraints.fixedNodeConstraint.length != 0 ? constraints.fixedNodeConstraint : undefined,
    relativePlacementConstraint: constraints.relativePlacementConstraint ? constraints.relativePlacementConstraint : undefined,
    alignmentConstraint: constraints.alignmentConstraint ? constraints.alignmentConstraint : undefined,
    initialEnergyOnIncremental: initialEnergyOnIncremental,
/*     stop: () => {      
      if (applyIncremental) {
        cy.layout({
          name: "fcose",
          randomize: false,
          animationDuration: 500,
          idealEdgeLength: idealEdgeLength,
          fixedNodeConstraint: constraints.fixedNodeConstraint.length != 0 ? constraints.fixedNodeConstraint : undefined,
          initialEnergyOnIncremental: 0.05
        }).run();
      }
    } */
  }).run();
};

/* Graph View Options */

$("#uploadSbgnml").on("click", function (e) {
	$("#file-input-sbgn").trigger('click');
});

document.getElementById("file-input-sbgn").addEventListener("change", async function (file) {
	let input = file.target;
	let reader = new FileReader();
	reader.onload = async function () {
		sbgnmlText = reader.result;
		await generateCyGraph("preset");
		sbgnmlText = undefined;
	};
	reader.readAsText(input.files[0]);
});

document.getElementById("downloadSbgnml").addEventListener("click", function () {
	let finalSbgnml = cytoscapeToSbgnml(cy, getMapType());
	finalSbgnml = format(finalSbgnml);
	let blob = new Blob([finalSbgnml], { type: "text/xml" });
	saveAs(blob, sbgnmlfilename);
});

document.getElementById("openNewt").addEventListener("click", async function () {
	let finalSbgnml = cytoscapeToSbgnml(cy, getMapType());
	finalSbgnml = format(finalSbgnml);
	const filename = await openInNewtAndDelete(finalSbgnml);
});

async function openInNewtAndDelete(sbgnContent) {
	let filename = 'diagram_' + Date.now() + '.sbgnml';
  const response = await fetch('http://3.95.207.114/upload', {
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
			fetch('/delete', {
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

export { sendRequestToGPT, getMapType };
